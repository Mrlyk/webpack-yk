const { SyncHook } = require("tapable");
const { toUnixPath, tryExtensions, renderRequire } = require("./utils");
const path = require("path");
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

class Compiler {
  constructor(options) {
    this.options = options; // 存储参数
    // 创建几个必要的钩子，简单点我们就使用同步钩子
    this.hooks = {
      // 开始编译时的钩子
      run: new SyncHook(),
      // 输出文件时的钩子
      emit: new SyncHook(),
      // 全部编译完成时的钩子
      done: new SyncHook(),
    };
    // webpack 配置的 path 根路径
    this.rootPath = this.options.context || toUnixPath(process.cwd());

    // 存放所有入口模块对象
    this.entries = new Set();
    // 存放所有依赖模块对象
    this.modules = new Set();
    // 存放所有代码块对象
    this.chunks = new Set();
    // 存放本次产出的文件对象
    this.assets = new Set();
    // 存放编译产生的所有文件名
    this.files = new Set();
  }

  // 开始编译
  run(callback) {
    // 在编译开始前手动触发 run 钩子
    this.hooks.run.call();
    const entry = this.getEntry();
    // 编译入口文件
    this.buildEntryModule(entry);
    // 输出文件到 assets 中
    this.creatChunkAssets(callback);
  }

  // 获取入口文件路径，是一个对象 默认使用 main 属性
  getEntry() {
    let entry = Object.create(null);
    const { entry: optionsEntry } = this.options;
    if (typeof optionsEntry === "string") {
      entry["main"] = optionsEntry;
    } else {
      entry = optionsEntry;
    }
    Object.entries(entry).forEach(([key, entryPath]) => {
      // 转换为绝对路径
      if (!path.isAbsolute(entryPath)) {
        entry[key] = toUnixPath(path.join(this.rootPath, entryPath));
      }
    });
    return entry;
  }

  buildEntryModule(entry) {
    Object.entries(entry).forEach(([entryName, path]) => {
      const entryObj = this.buildModule(entryName, path);
      this.entries.add(entryObj);
      this.buildUpChunk(entryName, entryObj);
    });
    console.log("entries:", this.entries);
    console.log("modules:", this.modules);
    console.log("chunks:", this.chunks);
  }

  buildModule(moduleName, modulePath) {
    // 1.读取源码，同时在当前实例上存储一份，以便插件也能访问
    const originSourceCode = (this.originSourceCode = fs.readFileSync(
      modulePath,
      "utf-8"
    ));
    // 2.同时需要复制一份给 loader 处理使用
    this.moduleCode = originSourceCode;
    this.handleLoader(modulePath);
    // 3.生成 module 对象
    const module = this.handleWebpackCompiler(moduleName, modulePath);
    // 返回 module
    return module;
  }

  handleLoader(modulePath) {
    const matchLoaders = [];
    const rules = this.options.module.rules;
    rules.forEach((loader) => {
      const testRule = loader.test;
      if (testRule.test(modulePath)) {
        // 仅处理 { test: /\.js$/, loader: 'babel-loader' } / { test: /\.js$/, use: ['babel-loader'] } 两种情况
        if (loader.loader) {
          matchLoaders.push(loader.loader);
        } else {
          matchLoaders.push(...loader.use);
        }
      }
    });
    // 倒序调用 loader
    for (let i = matchLoaders.length - 1; i >= 0; i--) {
      const loaderFn = require(matchLoaders[i]);
      // loader 处理完成
      this.moduleCode = loaderFn(this.moduleCode);
    }
  }

  handleWebpackCompiler(moduleName, modulePath) {
    // 将当前模块路径相对于根路径的地址作为 模块 ID
    const moduleId = "./" + path.posix.relative(this.rootPath, modulePath);
    const module = {
      id: moduleId,
      dependencies: new Set(),
      name: [moduleName], // entry 入口的名称
    };
    // 将 loader 处理过的代码转 ast
    const ast = parser.parse(this.moduleCode, { sourceType: module });
    // 遍历 ast ，找到所有 require 标识符
    traverse(ast, {
      CallExpression: (nodePath) => {
        const node = nodePath.node;
        // 如果存在引入的依赖，则需要处理他们的路径，获得绝对路径
        if (node.callee.name === "require") {
          // 获得原来的引入路径
          const requirePath = node.arguments[0].value;
          // 获取模块所在文件夹的路径
          const moduleDirName = path.posix.dirname(modulePath);
          // 获取绝对路径，获取前面的几个路径都是为了在 tryExtensions 中获取到真正文件的绝对路径
          // tryExtensions 是处理默认的文件后缀，就是 webpack resolve 里配置的 extensions 选项
          const absolutePath = tryExtensions(
            path.posix.join(moduleDirName, requirePath),
            this.options.resolve.extensions,
            requirePath,
            moduleDirName
          );
          // 依赖的模块也需要生成一个子 module
          const moduleId =
            "./" + path.posix.relative(this.rootPath, absolutePath);
          // webpack 自己实现的 require 方法，在浏览器上 cjs 规范是行不通的
          node.callee = t.identifier("__webpack_require__");
          node.arguments = [t.stringLiteral(moduleId)];
          // 为原来的 module 添加依赖，可以看到 webpack 只记录了依赖的引用路径，没有立刻去解析依赖
          const alreadyModules = Array.from(this.modules).map(
            (module) => module.id
          );
          if (!alreadyModules.includes(moduleId)) {
            module.dependencies.add(moduleId);
          } else {
            // 否则只新增入口，这也是为什么上面入口时一个数组格式
            this.modules.forEach((module) => {
              if (module.id === moduleId) {
                module.name.push(moduleName);
              }
            });
          }
        }
      },
    });
    // 将 AST 重新转回 code
    const { code } = generator(ast);
    // 将新代码挂载回模块对象
    module._source = code;
    // 遍历 dependencies set 对象
    module.dependencies.forEach((dependency) => {
      const depModule = this.buildModule(moduleName, dependency);
      // 将编译后的依赖模块存入 this.modules 对象
      this.modules.add(depModule);
    });
    return module;
  }

  buildUpChunk(entryName, entryObj) {
    const chunk = {
      name: entryName,
      entryModule: entryObj,
      // 根据 name 来查找当前这个依赖模块是不是属于这个 chunk
      modules: Array.from(this.modules).filter((module) =>
        module.name.includes(entryName)
      ),
    };
    this.chunks.add(chunk);
  }

  creatChunkAssets(callback) {
    // 首先获取我们的输出路径
    const output = this.options.output;
    this.chunks.forEach((chunk) => {
      // 支持我们平常的这种 [name] 写法
      const parseFileName = output.filename.replace("[name]", chunk.name);
      this.assets[parseFileName] = renderRequire(chunk);
    });
    // 别忘了调用输出文件时的钩子
    this.hooks.emit.call();
    // 输出目录不存在时首先创建
    if (!fs.existsSync(output.path)) {
      fs.mkdirSync(output.path);
    }
    // 存储所有输出文件名
    this.files = Object.keys(this.assets);
    Object.keys(this.assets).forEach((filename) => {
      const filePath = path.join(output.path, filename);
      // 输出文件
      fs.writeFileSync(filePath, this.assets[filename]);
    });
    // 也别忘了输出文件后触发的钩子
    this.hooks.done.call();
    // 回传参数给回调函数
    callback(null, {
      toJson: () => {
        return {
          entries: this.entries,
          modules: this.modules,
          files: this.files,
          chunks: this.chunks,
          assets: this.assets,
        };
      },
    });
  }
}

module.exports = Compiler;

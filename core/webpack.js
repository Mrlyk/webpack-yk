const Compiler = require("./compiler");

function webpack(options) {
  // 合并参数
  const mergeOptions = _mergeOptions(options);
  // 实例化 compiler 对象
  const compiler = new Compiler(mergeOptions);
  _loaderPlugin(mergeOptions.plugins, compiler);
  return compiler;
}

// 合并参数
function _mergeOptions(options) {
  // 命令运行在 node 环境中，可以通过 process.argv 获取 shell 参数
  // 第一个参数是 node 路径，第二个是 webpack 的脚本路径，第三个开始才是我们要的参数
  const shellOptions = process.argv.slice(2).reduce((option, argv) => {
    const [key, value] = argv.split("="); // 参数会被转换为 --xxx=xxx 的形式
    if (key && value) {
      const parseKey = key.slice(2); // 去除参数前的 --
      option[parseKey] = value;
    }
    return option;
  }, {});
  return { ...options, ...shellOptions }; // shell 参数优先
}

// 加载插件
function _loaderPlugin(plugins, compiler) {
  if (plugins && Array.isArray(plugins)) {
    plugins.forEach((plugin) => {
      plugin.apply(compiler);
    });
  }
}

module.exports = webpack;

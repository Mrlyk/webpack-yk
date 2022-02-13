const fs = require("fs");
/**
 * toUnixPath 转换路径分隔符
 * @param { string } path
 * @returns
 */
function toUnixPath(path) {
  if (!path || typeof path !== "string") return "";
  return path.replace(/\\/g, "/");
}

/**
 * tryExtensions 尝试配置的扩展名
 * @param {*} modulePath 模块绝对路径
 * @param {*} extensions 配置的可兼容扩展名数组
 * @param {*} requirePath 原始 require 中引入的路径
 * @param {*} moduleContext 模块所在的目录路径
 */
function tryExtensions(modulePath, extensions, requirePath, moduleContext) {
  extensions.unshift(""); // 在头部加入空字符串，优先尝试不使用扩展名
  for (let extension of extensions) {
    if (fs.existsSync(modulePath + extension)) {
      return modulePath + extension;
    }
  }
  // 这里只处理了简单情况，像如果路径是文件夹的话默认查找文件夹里的 index.js 未实现
  throw new Error(
    `No module, Error: Can't resolve ${originModulePath} in  ${moduleContext}`
  );
}

function renderRequire(chunk) {
  const { name, entryModule, modules } = chunk;
  return `(() => {
    var __webpack_modules__ = {
      ${modules.map((module) => {
        return `'${module.id}': module => { ${module._source} }`;
      }).join(',')}
    };
    
    var __webpack_module_cache__ = {};

    function __webpack_require__(moduleId) {
      var cacheModule = __webpack_module_cache__[moduleId]
      if(void 0 !== cacheModule) return cacheModule.exports
      var module = (__webpack_module_cache__[moduleId] = {
        exports: {}
      })
      __webpack_modules__[moduleId](module, module.exports, __webpack_require__)
      // 返回 module 中的 module.exports 对象
      return module.exports
    }
    
    (() => {
      ${entryModule._source}
    })()
  })()`;
}

module.exports = {
  toUnixPath,
  tryExtensions,
  renderRequire,
};

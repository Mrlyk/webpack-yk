(() => {
  var __webpack_modules__ = {
    "./example/src/modules.js": (module) => {
      /** loader1 = mrlyk */

      /** loader2 = 2/13/2022 */
      const testModule = "module";
      module.exports = {
        testModule,
      };
    },
  };

  var __webpack_module_cache__ = {};

  function __webpack_require__(moduleId) {
    var cacheModule = __webpack_module_cache__[moduleId];
    if (void 0 !== cacheModule) return cacheModule.exports;
    var module = (__webpack_module_cache__[moduleId] = {
      exports: {},
    });
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    // 返回 module 中的 module.exports 对象
    return module.exports;
  }

  (() => {
    /** loader1 = mrlyk */

    /** loader2 = 2/13/2022 */
    const depModule = __webpack_require__("./example/src/modules.js");

    console.log("dependencies:", depModule);
    console.log("Entry1 build");
  })();
})();

class PluginB {
  apply(compiler) {
    // 在我们在 compiler 对象上声明的 hooks 属性的 done 钩子上注册事件 
    compiler.hooks.done.tap('PluginB', () => {
      console.log('PluginB is Running!')
    })
  }
}
module.exports = PluginB
class PluginA {
  apply(compiler) {
    // 在我们在 compiler 对象上声明的 hooks 属性的 run 钩子上注册事件 
    compiler.hooks.run.tap('PluginA', () => {
      console.log('PluginA is Running!')
    })
  }
}

module.exports = PluginA
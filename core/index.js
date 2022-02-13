const webpack = require("./webpack");
const config = require("../example/webpack.config");

// 一：初始化参数，从 shell 和 webpack.config.js 合成
const compiler = webpack(config);

// 二：调用 run 方法开始编译
compiler.run((err, stats) => {
  if (err) {
    throw err;
  }
  stats.toJson();
});

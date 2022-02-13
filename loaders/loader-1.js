function loader1(sourceCode) {
  console.log("loader1 running");
  return "/** loader1 = mrlyk */" + sourceCode;
}

module.exports = loader1;

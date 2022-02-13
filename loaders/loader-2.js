function loader2(sourceCode) {
  console.log("loader2 running");
  return `/** loader2 = ${new Date().toLocaleDateString()} */` + sourceCode;
}

module.exports = loader2;



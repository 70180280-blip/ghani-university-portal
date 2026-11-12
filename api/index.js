let errorLog = [];
let app = null;

try {
  errorLog.push('Starting require(../server)');
  app = require('../server');
  errorLog.push('Require server success');
} catch (err) {
  errorLog.push('Error requiring server: ' + err.message + '\n' + err.stack);
}

module.exports = (req, res) => {
  if (!app || errorLog.some(e => e.includes('Error'))) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('DIAGNOSTIC LOG:\n' + errorLog.join('\n'));
  }
  return app(req, res);
};

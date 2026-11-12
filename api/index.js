let app = null;
let initError = null;

try {
  app = require('../server');
} catch (e) {
  initError = {
    message: e.message,
    stack: e.stack
  };
}

module.exports = (req, res) => {
  if (initError) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).send(JSON.stringify({
      error: 'Vercel Serverless Function Init Error',
      initError
    }, null, 2));
  }
  return app(req, res);
};

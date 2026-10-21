const { isAuthed } = require('../lib/auth');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ authed: isAuthed(req) });
};

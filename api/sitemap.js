const { readContent } = require('../lib/store');
const { sitemap, originOf } = require('../lib/seo');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  res.status(200).send(sitemap(await readContent(), originOf(req)));
};

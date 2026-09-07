// AI scheduling is deferred until it can commit decisions with the canonical tick.
// The original endpoint remains available in the preserved pre-beta Git revision.
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({fallback:true,reason:'shared_world_uses_instincts'});
};

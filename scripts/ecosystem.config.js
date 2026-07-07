module.exports = {
  apps: [{
    name: "wa-gateway",
    script: "wa_gateway.js",
    max_restarts: 5,
    min_uptime: 10000
  }]
}

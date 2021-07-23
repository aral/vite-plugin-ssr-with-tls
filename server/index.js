const express = require('express')
const { createPageRender } = require('vite-plugin-ssr')
const https = require('@small-tech/https')
const hostname = require('@small-tech/cross-platform-hostname')

const path = require('path')
const fs = require('fs')
const os = require('os')

const isProduction = process.env.NODE_ENV === 'production'
const root = `${__dirname}/..`

startServer()

async function startServer() {
  const app = express()

  let viteDevServer
  if (isProduction) {
    app.use(express.static(`${root}/dist/client`, { index: false }))
  } else {
    // Set  Vite server up as middleware and configure HMR to use
    // same development-time certificate as used by @small-tech/https.
    const certificateDirectory = path.join(os.homedir(), '.small-tech.org', 'https', 'local')
    const cert = fs.readFileSync(path.join(certificateDirectory, 'localhost.pem'), 'utf-8')
    const key = fs.readFileSync(path.join(certificateDirectory, 'localhost-key.pem'), 'utf-8')

    const vite = require('vite')
    viteDevServer = await vite.createServer({
      root,
      server: {
        middlewareMode: true,
        https: {
          cert,
          key
        }
      },
    })
    app.use(viteDevServer.middlewares)
  }

  const renderPage = createPageRender({ viteDevServer, isProduction, root })
  app.get('*', async (req, res, next) => {
    const url = req.originalUrl
    const pageContext = {
      url
    }
    const result = await renderPage(pageContext)
    if (result.nothingRendered) return next()
    res.status(result.statusCode).send(result.renderResult)
  })

  const server = isProduction ? https.createServer({ domains: [hostname] }, app) : https.createServer(app)
  server.listen(443, () => {
    console.log(`Server running at https://${isProduction ? hostname : 'localhost'}`)
  })
}

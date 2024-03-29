// This test uses the ../../../example-express, installing a snapshot and
// checking the metadata for deferreds and healthy modules.
import path from 'path'
import spok from 'spok'
import test from 'tape'
import rimraf from 'rimraf'
import { exec as execOrig } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execOrig)
const rmrf = promisify(rimraf)

const projectBaseDir = path.join(__dirname, '..', '..', '..', 'example-express')
const cacheDir = path.join(projectBaseDir, 'cache')
const metadataFile = path.join(cacheDir, 'snapshot-meta.json')

test('integration: install snapshot for example-express', async (t) => {
  try {
    await rmrf(cacheDir)
  } catch (err: any) {
    t.fail(err.toString())
    return t.end()
  }

  const cmd = `node ./snapshot/install-snapshot.js`
  try {
    await exec(cmd, { cwd: projectBaseDir })
    const metadata = require(metadataFile)
    spok(t, metadata, EXPECTED)
    t.end()
  } catch (err: any) {
    t.fail(err.toString())
  }
})

const EXPECTED = {
  norewrite: [],
  deferred: [
    './node_modules/body-parser/index.js',
    './node_modules/debug/src/browser.js',
    './node_modules/debug/src/index.js',
    './node_modules/debug/src/node.js',
    './node_modules/depd/index.js',
    './node_modules/express/lib/application.js',
    './node_modules/express/lib/request.js',
    './node_modules/express/lib/response.js',
    './node_modules/express/lib/router/index.js',
    './node_modules/express/lib/router/route.js',
    './node_modules/http-errors/index.js',
    './node_modules/iconv-lite/encodings/dbcs-codec.js',
    './node_modules/iconv-lite/encodings/index.js',
    './node_modules/iconv-lite/encodings/internal.js',
    './node_modules/iconv-lite/lib/index.js',
    './node_modules/iconv-lite/lib/streams.js',
    './node_modules/methods/index.js',
    './node_modules/mime/mime.js',
    './node_modules/safe-buffer/index.js',
    './node_modules/safer-buffer/safer.js',
    './node_modules/send/index.js',
    './node_modules/send/node_modules/http-errors/index.js',
  ],
  healthy: [
    './node_modules/accepts/index.js',
    './node_modules/array-flatten/array-flatten.js',
    './node_modules/body-parser/lib/read.js',
    './node_modules/body-parser/lib/types/json.js',
    './node_modules/body-parser/lib/types/raw.js',
    './node_modules/body-parser/lib/types/text.js',
    './node_modules/body-parser/lib/types/urlencoded.js',
    './node_modules/bytes/index.js',
    './node_modules/content-disposition/index.js',
    './node_modules/content-type/index.js',
    './node_modules/cookie-signature/index.js',
    './node_modules/cookie/index.js',
    './node_modules/debug/src/debug.js',
    './node_modules/depd/lib/compat/callsite-tostring.js',
    './node_modules/depd/lib/compat/event-listener-count.js',
    './node_modules/depd/lib/compat/index.js',
    './node_modules/destroy/index.js',
    './node_modules/ee-first/index.js',
    './node_modules/encodeurl/index.js',
    './node_modules/escape-html/index.js',
    './node_modules/etag/index.js',
    './node_modules/express/index.js',
    './node_modules/express/lib/express.js',
    './node_modules/express/lib/middleware/init.js',
    './node_modules/express/lib/middleware/query.js',
    './node_modules/express/lib/router/layer.js',
    './node_modules/express/lib/utils.js',
    './node_modules/express/lib/view.js',
    './node_modules/finalhandler/index.js',
    './node_modules/forwarded/index.js',
    './node_modules/fresh/index.js',
    './node_modules/http-errors/node_modules/inherits/inherits.js',
    './node_modules/http-errors/node_modules/inherits/inherits_browser.js',
    './node_modules/iconv-lite/encodings/dbcs-data.js',
    './node_modules/iconv-lite/encodings/sbcs-codec.js',
    './node_modules/iconv-lite/encodings/sbcs-data-generated.js',
    './node_modules/iconv-lite/encodings/sbcs-data.js',
    './node_modules/iconv-lite/encodings/tables/big5-added.json',
    './node_modules/iconv-lite/encodings/tables/cp936.json',
    './node_modules/iconv-lite/encodings/tables/cp949.json',
    './node_modules/iconv-lite/encodings/tables/cp950.json',
    './node_modules/iconv-lite/encodings/tables/eucjp.json',
    './node_modules/iconv-lite/encodings/tables/gb18030-ranges.json',
    './node_modules/iconv-lite/encodings/tables/gbk-added.json',
    './node_modules/iconv-lite/encodings/tables/shiftjis.json',
    './node_modules/iconv-lite/encodings/utf16.js',
    './node_modules/iconv-lite/encodings/utf7.js',
    './node_modules/iconv-lite/lib/bom-handling.js',
    './node_modules/iconv-lite/lib/extend-node.js',
    './node_modules/inherits/inherits.js',
    './node_modules/inherits/inherits_browser.js',
    './node_modules/ipaddr.js/lib/ipaddr.js',
    './node_modules/media-typer/index.js',
    './node_modules/merge-descriptors/index.js',
    './node_modules/mime-db/db.json',
    './node_modules/mime-db/index.js',
    './node_modules/mime-types/index.js',
    './node_modules/mime/types.json',
    './node_modules/ms/index.js',
    './node_modules/negotiator/index.js',
    './node_modules/negotiator/lib/charset.js',
    './node_modules/negotiator/lib/encoding.js',
    './node_modules/negotiator/lib/language.js',
    './node_modules/negotiator/lib/mediaType.js',
    './node_modules/on-finished/index.js',
    './node_modules/parseurl/index.js',
    './node_modules/path-to-regexp/index.js',
    './node_modules/proxy-addr/index.js',
    './node_modules/qs/lib/formats.js',
    './node_modules/qs/lib/index.js',
    './node_modules/qs/lib/parse.js',
    './node_modules/qs/lib/stringify.js',
    './node_modules/qs/lib/utils.js',
    './node_modules/range-parser/index.js',
    './node_modules/raw-body/index.js',
    './node_modules/send/node_modules/ms/index.js',
    './node_modules/serve-static/index.js',
    './node_modules/setprototypeof/index.js',
    './node_modules/statuses/codes.json',
    './node_modules/statuses/index.js',
    './node_modules/toidentifier/index.js',
    './node_modules/type-is/index.js',
    './node_modules/unpipe/index.js',
    './node_modules/utils-merge/index.js',
    './node_modules/vary/index.js',
    './snapshot/snapshot.js',
  ],
  deferredHashFile: 'yarn.lock',
}

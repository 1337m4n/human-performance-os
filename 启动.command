#!/bin/zsh
set -e
cd -- "${0:A:h}"
python3 - <<'PY'
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import webbrowser

url = 'http://127.0.0.1:5183/'
with ThreadingHTTPServer(('127.0.0.1', 5183), partial(SimpleHTTPRequestHandler, directory='dist')) as server:
    print('Human Performance OS 已启动：' + url, flush=True)
    print('保持此终端开启；Control+C 结束服务。', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY

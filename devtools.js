const reload = require('electron-reload')
const debug = require('electron-debug')

function run_dev_tools() {
    console.log("dev")
    reload(__dirname)
    debug()
}

exports.run_dev_tools = run_dev_tools
  

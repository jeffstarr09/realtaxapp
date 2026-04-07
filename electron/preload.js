const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("realtax", {
  unify: (files) => ipcRenderer.invoke("unify", files),
});

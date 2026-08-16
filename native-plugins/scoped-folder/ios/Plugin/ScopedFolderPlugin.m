#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ScopedFolderPlugin, "ScopedFolder",
           CAP_PLUGIN_METHOD(pickFolder, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(writeFile, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(readFile, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(mkdir, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(readdir, CAPPluginReturnPromise);
)

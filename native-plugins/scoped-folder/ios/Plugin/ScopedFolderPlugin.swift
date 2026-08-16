import Foundation
import Capacitor
import UniformTypeIdentifiers

@objc(ScopedFolderPlugin)
public class ScopedFolderPlugin: CAPPlugin, UIDocumentPickerDelegate {
    private var savedCall: CAPPluginCall?

    @objc func pickFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker: UIDocumentPickerViewController
            if #available(iOS 14.0, *) {
                picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            } else {
                picker = UIDocumentPickerViewController(documentTypes: ["public.folder"], in: .open)
            }
            picker.allowsMultipleSelection = false
            picker.delegate = self
            self.savedCall = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else {
            savedCall?.reject("No folder selected")
            savedCall = nil
            return
        }
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed {
                url.stopAccessingSecurityScopedResource()
            }
        }
        do {
            let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
            let name = (try? url.resourceValues(forKeys: [.nameKey]).name) ?? url.lastPathComponent
            savedCall?.resolve([
                "folder": [
                    "id": bookmark.base64EncodedString(),
                    "name": name
                ]
            ])
        } catch {
            savedCall?.reject("Failed to create bookmark: \(error.localizedDescription)")
        }
        savedCall = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        savedCall?.reject("User cancelled")
        savedCall = nil
    }

    @objc func writeFile(_ call: CAPPluginCall) {
        withFolderURL(call) { folderURL in
            guard let path = call.getString("path"),
                  let dataStr = call.getString("data") else {
                throw ScopedFolderError.invalidArgument
            }
            let encoding = call.getString("encoding") ?? "utf8"
            let data: Data
            if encoding == "base64" {
                data = Data(base64Encoded: dataStr) ?? Data()
            } else {
                data = Data(dataStr.utf8)
            }
            let target = folderURL.appendingScopedPath(path)
            try FileManager.default.createDirectory(
                at: target.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try data.write(to: target, options: .atomic)
            call.resolve()
        }
    }

    @objc func readFile(_ call: CAPPluginCall) {
        withFolderURL(call) { folderURL in
            guard let path = call.getString("path") else {
                throw ScopedFolderError.invalidArgument
            }
            let encoding = call.getString("encoding") ?? "utf8"
            let target = folderURL.appendingScopedPath(path)
            let data = try Data(contentsOf: target)
            if encoding == "base64" {
                call.resolve(["data": data.base64EncodedString()])
            } else {
                call.resolve(["data": String(decoding: data, as: UTF8.self)])
            }
        }
    }

    @objc func mkdir(_ call: CAPPluginCall) {
        withFolderURL(call) { folderURL in
            guard let path = call.getString("path") else {
                throw ScopedFolderError.invalidArgument
            }
            let recursive = call.getBool("recursive") ?? true
            let dir = folderURL.appendingScopedPath(path, isDirectory: true)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: recursive)
            call.resolve()
        }
    }

    @objc func readdir(_ call: CAPPluginCall) {
        withFolderURL(call) { folderURL in
            let rel = call.getString("path") ?? ""
            let dir = rel.isEmpty
                ? folderURL
                : folderURL.appendingScopedPath(rel, isDirectory: true)
            var result: [[String: Any]] = []
            let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey, .nameKey]
            let urls = try FileManager.default.contentsOfDirectory(
                at: dir,
                includingPropertiesForKeys: keys,
                options: [.skipsHiddenFiles]
            )
            for u in urls {
                let vals = try u.resourceValues(forKeys: Set(keys))
                var entry: [String: Any] = [
                    "name": vals.name ?? u.lastPathComponent,
                    "isDir": vals.isDirectory ?? false
                ]
                if let size = vals.fileSize {
                    entry["size"] = size
                }
                if let mtime = vals.contentModificationDate?.timeIntervalSince1970 {
                    entry["mtime"] = mtime
                }
                result.append(entry)
            }
            call.resolve(["entries": result])
        }
    }

    private func withFolderURL(_ call: CAPPluginCall, _ block: (URL) throws -> Void) {
        guard let folder = call.getObject("folder"),
              let id = folder["id"] as? String,
              let bookmarkData = Data(base64Encoded: id) else {
            call.reject("Missing or invalid folder.id (bookmark)")
            return
        }
        var stale = false
        do {
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: [],
                relativeTo: nil,
                bookmarkDataIsStale: &stale
            )
            guard url.startAccessingSecurityScopedResource() else {
                call.reject("Failed to access security scoped resource")
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }
            try block(url)
        } catch {
            call.reject("Bookmark resolution failed: \(error.localizedDescription)")
        }
    }
}

private enum ScopedFolderError: Error {
    case invalidArgument
}

private extension URL {
    func appendingScopedPath(_ path: String, isDirectory: Bool = false) -> URL {
        let parts = path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        var u = self
        for (index, part) in parts.enumerated() {
            let last = index == parts.count - 1
            u.appendPathComponent(part, isDirectory: last ? isDirectory : true)
        }
        return u
    }
}

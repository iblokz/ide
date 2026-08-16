export interface FolderRef {
	id: string;
	name?: string;
}

export interface ScopedFolderPlugin {
	pickFolder(): Promise<{ folder: FolderRef }>;
	readdir(options: { folder: FolderRef; path?: string }): Promise<{
		entries: Array<{ name: string; isDir: boolean; size?: number | null; mtime?: number | null }>;
	}>;
	readFile(options: { folder: FolderRef; path: string; encoding?: 'utf8' | 'base64' }): Promise<{ data: string }>;
	writeFile(options: {
		folder: FolderRef;
		path: string;
		data: string;
		encoding?: 'utf8' | 'base64';
		mimeType?: string;
	}): Promise<void>;
	mkdir(options: { folder: FolderRef; path: string; recursive?: boolean }): Promise<void>;
}

export declare const ScopedFolder: ScopedFolderPlugin;

/**
 * Stands in for the `obsidian` module so scanner.ts can be bundled and tested
 * outside the app. Only the shapes the scanner touches need to exist.
 */
export class App {}
export class TFile {}
export class TFolder {}
export class TAbstractFile {}
export class Plugin {}
export class ItemView {}
export class Modal {}
export class FuzzySuggestModal {}
export class PluginSettingTab {}
export class Setting {}
export class Menu {}
export class Notice {}
export class WorkspaceLeaf {}
export function setIcon() {}
export function normalizePath(p) {
	return p;
}
export function debounce(fn) {
	return fn;
}

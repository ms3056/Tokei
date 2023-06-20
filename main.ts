import { DateTime, Info } from "luxon";
import {
	addIcon,
	App,
	ItemView,
	Menu,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	Notice,
	ExtraButtonComponent,
	TextComponent,
} from "obsidian";

const ClockViewType = "my-clock-view";

class ClockView extends ItemView {
	private readonly plugin: ClockPlugin;
	private timeContainer: HTMLElement;
	private dateContainer: HTMLElement;
	private timezoneContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: ClockPlugin) {
		super(leaf);
		this.plugin = plugin;

		// Create containers for time, date, and timezone
		this.timeContainer = this.containerEl.createDiv();
		this.dateContainer = this.containerEl.createDiv();
		this.timezoneContainer = this.containerEl.createDiv();
	}

	public async onOpen(): Promise<void> {
		this.displayTime();
	}

	public getViewType(): string {
		return ClockViewType;
	}

	public getDisplayText(): string {
		return "Clock";
	}

	public getIcon(): string {
		return "clock";
	}

	// Omitted onHeaderMenu function as it is commented out

	private sortTimeZones(): TimezonePair[] {
		const currentOffset = DateTime.local().offset;

		// Sort the timezone pairs based on the difference from the current offset in descending order
		return this.plugin.settings.timeZonePairs.slice().sort((a, b) => {
			const offsetA = parseFloat(a.offset);
			const offsetB = parseFloat(b.offset);

			const diffA = Math.abs(currentOffset - offsetA);
			const diffB = Math.abs(currentOffset - offsetB);

			return diffB - diffA;
		});
	}

	public displayTime(): void {
		this.timeContainer.empty();
		this.dateContainer.empty();
		this.timezoneContainer.empty();

		// Displaying time based on user's format or default
		const currentTime = DateTime.local().toFormat(
			this.plugin.settings.timeFormat
		);
		this.timeContainer.createEl("h2", {
			cls: "time-display",
			text: currentTime,
		});

		if (this.plugin.settings.showDate) {
			const currentDate = DateTime.local().toFormat(
				this.plugin.settings.dateFormat
			);
			this.dateContainer.createEl("h2", {
				cls: "date-display",
				text: currentDate,
			});
		}

		// Sort the timezone pairs
		const sortedTimeZones = this.sortTimeZones();

		// Update the timezone pairs
		if (this.plugin.settings.showTimeZone) {
			const timezoneContainer = this.timezoneContainer.createEl("div", {
				cls: "timezone-container",
			});

			sortedTimeZones.forEach((entry) => {
				if (entry.offset) {
					const offset = parseFloat(entry.offset);
					const timezoneTime = DateTime.utc()
						.plus({ hours: offset })
						.toFormat(this.plugin.settings.timezoneFormat);

					// Creating timezone pair div and appending name and time divs to it
					const timezonePair = timezoneContainer.createEl("div", {
						cls: "timezone-pair",
					});
					timezonePair.createEl("div", {
						cls: "timezone-name",
						text: entry.name,
					});
					timezonePair.createEl("div", {
						cls: "timezone-time",
						text: timezoneTime,
					});
				}
			});
		}
	}
}

interface TimezonePair {
	name: string;
	offset: string;
}

interface ClockSettings {
	timeFormat: string;
	showDate: boolean;
	dateFormat: string;
	showTimeZone: boolean;
	timeZonePairs: TimezonePair[];
	timezoneFormat: string;
}

const DEFAULT_SETTINGS: ClockSettings = {
	timeFormat: "HH:mm",
	showDate: true,
	dateFormat: "EEE - dd",
	showTimeZone: true,
	timeZonePairs: [{ name: "", offset: "" }],
	timezoneFormat: "HH:mm - EEEEE",
};

export default class ClockPlugin extends Plugin {
	public view: ClockView;
	public settings: ClockSettings;

	public async onload(): Promise<void> {
		// console.log("Clock: Loading plugin v" + this.manifest.version);

		// Load plugin settings, using default values if no saved settings are found
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// Register the ClockView with the plugin
		this.registerView(
			ClockViewType,
			(leaf) => (this.view = new ClockView(leaf, this))
		);

		// Add the 'Open Clock' command to open the Clock plugin
		this.addCommand({
			id: "clock-open",
			name: "Open Clock",
			callback: async () => {
				let [leaf] = this.app.workspace.getLeavesOfType(ClockViewType);
				if (!leaf) {
					leaf = this.app.workspace.getRightLeaf(false);
					if (leaf) {
						await leaf.setViewState({ type: ClockViewType });
					} else {
						// Handle case where leaf is null or undefined
					}
				}
				if (leaf) {
					this.app.workspace.revealLeaf(leaf);
				}
			},
		});

		// Initialize the Clock plugin view
		if (this.app.workspace.layoutReady) {
			await this.initView();
		} else {
			const checkLayoutInterval = setInterval(async () => {
				if (this.app.workspace.layoutReady) {
					await this.initView();
					clearInterval(checkLayoutInterval);
				}
			}, 1000);
		}

		// Add the ClockSettingTab to the plugin's settings
		this.addSettingTab(new ClockSettingTab(this.app, this));
	}

	public onunload(): void {
		// console.log("Clock: Unloading plugin");
		this.app.workspace.detachLeavesOfType(ClockViewType);
	}

	private async initView(): Promise<void> {
		let [leaf] = this.app.workspace.getLeavesOfType(ClockViewType);
		if (!leaf) {
			leaf = this.app.workspace.getLeaf();
			if (leaf) {
				await leaf.setViewState({ type: ClockViewType });
			} else {
				// Handle case where leaf is null or undefined
			}
		}
		if (leaf) {
			this.app.workspace.revealLeaf(leaf);
		}
		this.view.displayTime();
		setInterval(() => {
			this.view.displayTime();
		}, 1000);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class ClockSettingTab extends PluginSettingTab {
	private readonly plugin: ClockPlugin;

	constructor(app: App, plugin: ClockPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h1", { text: "Clock Settings" });

		// Add a link to the Luxon reference
		let h2El = containerEl.createEl("p", {
			text: "Use the Luxon format for all time and date settings: ",
		});
		h2El.createEl("a", {
			text: " Luxon Reference",
			href: "https://moment.github.io/luxon/docs/manual/formatting.html",
			attr: {
				target: "_blank",
			},
		});

		let textField: TextComponent;

		// Time Format Settings
		new Setting(containerEl)
			.setName("Time format")
			.setDesc(
				createFragment((fragment) => {
					fragment.append(
						"Default Luxon format is ",
						fragment.createEl("code", {
							text: "HH:mm",
						})
					);
				})
			)
			.addText((text) => {
				textField = text
					.setPlaceholder("Enter the time format")
					.setValue(this.plugin.settings.timeFormat);

				// Only save the setting when 'Enter' is pressed
				textField.inputEl.onkeypress = async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						this.plugin.settings.timeFormat =
							textField.inputEl.value;
						await this.plugin.saveData(this.plugin.settings);
						this.plugin.view.displayTime();
						textField.inputEl.blur(); // Lose focus
					}
				};
			})
			.addExtraButton((button) =>
				button
					.setIcon("reset")
					.setTooltip("Reset time format")
					.onClick(async () => {
						this.plugin.settings.timeFormat =
							DEFAULT_SETTINGS.timeFormat;
						await this.plugin.saveData(this.plugin.settings);
						this.plugin.view.displayTime();

						// Update the value in the text field to reflect the reset value
						textField.setValue(this.plugin.settings.timeFormat);
					})
			);

		// Date Format Settings
		new Setting(containerEl)
			.setName("Show date")
			.setDesc("Enable to show the date.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showDate)
					.onChange(async (value) => {
						this.plugin.settings.showDate = value;
						await this.plugin.saveData(this.plugin.settings);

						const clockView = this.app.workspace
							.getLeavesOfType("my-clock-view")
							.find((leaf) => leaf.view instanceof ClockView);
						if (clockView) {
							(clockView.view as ClockView).displayTime(); // Update the clock immediately
						}

						// Show or hide the Date Format setting based on the toggle value
						if (value) {
							dateFormatSetting.settingEl.style.display = "";
						} else {
							dateFormatSetting.settingEl.style.display = "none";
						}
					});
			});

		let dateFormatSetting = new Setting(containerEl)
			.setName("Date format")
			.setDesc(
				createFragment((fragment) => {
					fragment.append(
						"Default Luxon format is ",
						fragment.createEl("code", {
							text: "DDD",
						})
					);
				})
			)
			.addText((text) => {
				let textField = text
					.setPlaceholder("Enter the date format")
					.setValue(this.plugin.settings.dateFormat);

				textField.inputEl.onkeypress = async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						this.plugin.settings.dateFormat =
							textField.inputEl.value;
						await this.plugin.saveData(this.plugin.settings);
						const clockView = this.app.workspace
							.getLeavesOfType("my-clock-view")
							.find((leaf) => leaf.view instanceof ClockView);
						if (clockView) {
							(clockView.view as ClockView).displayTime();
						}
						textField.inputEl.blur();
					}
				};

				// Show or hide the setting based on the 'Show Date' toggle value
				if (!this.plugin.settings.showDate) {
					textField.inputEl.style.display = "none";
				}
			})
			.addExtraButton((button) => {
				button
					.setIcon("reset")
					.setTooltip("Reset date format")
					.onClick(async () => {
						this.plugin.settings.dateFormat =
							DEFAULT_SETTINGS.dateFormat;
						await this.plugin.saveData(this.plugin.settings);
						this.display();
						new Notice("Date Format Reset");

						const clockView = this.app.workspace
							.getLeavesOfType("my-clock-view")
							.find((leaf) => leaf.view instanceof ClockView);
						if (clockView) {
							(clockView.view as ClockView).displayTime();
						}
					});
			});

		// Show Timezone Toggle
		new Setting(containerEl)
			.setName("Show Timezone")
			.setDesc("Enable to show the timezone.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showTimeZone)
					.onChange(async (value) => {
						this.plugin.settings.showTimeZone = value;
						await this.plugin.saveData(this.plugin.settings);
						const clockView = this.app.workspace
							.getLeavesOfType("clock-view")
							.find((leaf) => leaf.view instanceof ClockView);
						if (clockView) {
							(clockView.view as ClockView).displayTime(); // Update the clock immediately
						}

						// Show or hide the Timezone settings based on the toggle value
						timezoneSetting.settingEl.style.display = value
							? ""
							: "none";
						timezoneFormatSetting.settingEl.style.display = value
							? ""
							: "none";
					});
			});

		// Timezone Settings
		let timezoneSetting = new Setting(containerEl)
			.setName("Timezone settings")
			.setDesc(
				createFragment((fragment) => {
					fragment.append(
						"Enter your timezone pairs.",
						fragment.createEl("a", {
							text: " Reference",
							href: "https://www.timeanddate.com/time/map/",
						}),
						fragment.createEl("br"),
						fragment.createEl("br"),
						"Names and Offset pairs are not validated."
					);
				})
			);

		let timezoneSettingDiv = timezoneSetting.settingEl.createEl("div"); // Here is where we will attach the table

		if (this.plugin.settings.showTimeZone) {
			const table = timezoneSettingDiv.createEl("table");
			const headerRow = table.createEl("tr");
			headerRow.createEl("th", { text: "Timezone Name" });
			headerRow.createEl("th", { text: "Timezone Offset" });
			headerRow.createEl("th", { text: "" });

			this.plugin.settings.timeZonePairs.forEach((entry, index) => {
				const row = table.createEl("tr");

				// Timezone Name input field
				const nameCell = row.createEl("td");
				const nameInput = nameCell.createEl("input", {
					type: "text",
					value: entry.name,
				});

				// Save the settings when Enter is pressed in the Name input field
				const saveSettings = async () => {
					if (
						nameInput.value.trim() !== "" &&
						offsetInput.value.trim() !== ""
					) {
						this.plugin.settings.timeZonePairs[index].name =
							nameInput.value;
						this.plugin.settings.timeZonePairs[index].offset =
							offsetInput.value;
						await this.plugin.saveSettings();
					}
				};

				nameInput.addEventListener("keydown", async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await saveSettings();
						nameInput.blur();
					}
				});

				// Timezone Offset input field
				const offsetCell = row.createEl("td");
				const offsetInput = offsetCell.createEl("input", {
					type: "text",
					value: entry.offset,
				});

				offsetInput.addEventListener("keydown", async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await saveSettings();
						offsetInput.blur();
					}
				});

				// Buttons for deleting and adding timezone entries
				const buttonsCell = row.createEl("td");

				if (index !== 0) {
					const deleteButton = buttonsCell.createEl("button", {
						text: "-",
					});
					deleteButton.classList.add("deleteButtonClass");
					deleteButton.addEventListener("click", async () => {
						this.plugin.settings.timeZonePairs.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					});
				}

				if (index === this.plugin.settings.timeZonePairs.length - 1) {
					const addButton = buttonsCell.createEl("button", {
						text: "+",
					});
					addButton.classList.add("addButtonClass");
					addButton.addEventListener("click", async () => {
						// Limit timezone entries to 5
						if (this.plugin.settings.timeZonePairs.length < 5) {
							this.plugin.settings.timeZonePairs.push({
								name: "",
								offset: "",
							});
							this.display();
						} else {
							// Max entries reached
							new Notice("Maximum timezone entries added.");
						}
					});
				}

				if (
					index !== 0 &&
					index === this.plugin.settings.timeZonePairs.length - 1
				) {
					buttonsCell.classList.add("twoButtonsClass");
				}
			});
		}

		let timezoneFormatField: TextComponent;

		let timezoneFormatSetting = new Setting(containerEl)
			.setName("Timezone Format")
			.setDesc(
				createFragment((fragment) => {
					fragment.append(
						"Default Luxon format is ",
						fragment.createEl("code", {
							text: "HH:mm - EEEEE",
						})
					);
				})
			)
			.addText((text) => {
				timezoneFormatField = text
					.setPlaceholder("Enter the timezone format")
					.setValue(this.plugin.settings.timezoneFormat);

				timezoneFormatField.inputEl.onkeypress = async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						this.plugin.settings.timezoneFormat =
							timezoneFormatField.inputEl.value;
						await this.plugin.saveData(this.plugin.settings);
						const clockView = this.app.workspace
							.getLeavesOfType("clock-view")
							.find((leaf) => leaf.view instanceof ClockView);
						if (clockView) {
							(clockView.view as ClockView).displayTime();
						}
						timezoneFormatField.inputEl.blur();
					}
				};
			})
			.addExtraButton((button) =>
				button
					.setIcon("reset")
					.setTooltip("Reset timezone format")
					.onClick(async () => {
						this.plugin.settings.timezoneFormat =
							DEFAULT_SETTINGS.timezoneFormat;
						await this.plugin.saveData(this.plugin.settings);
						this.plugin.view.displayTime();

						// Update the value in the text field to reflect the reset value
						timezoneFormatField.setValue(
							this.plugin.settings.timezoneFormat
						);
					})
			);

		// Add these lines to remove the borders
		dateFormatSetting.settingEl.style.borderTop = "none";
		timezoneSetting.settingEl.style.borderTop = "none";
		timezoneFormatSetting.settingEl.style.borderTop = "none";

		if (!this.plugin.settings.showTimeZone) {
			timezoneSetting.settingEl.style.display = "none";
			timezoneFormatSetting.settingEl.style.display = "none";
		}
	}
}

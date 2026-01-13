module.exports = {
	getActions(self) {
		return {
			// Timer Control Actions
			start: {
				name: 'Start Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/start')
				},
			},
			pause: {
				name: 'Pause Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/pause')
				},
			},
			resume: {
				name: 'Resume Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/resume')
				},
			},
			toggle: {
				name: 'Toggle Play/Pause',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/toggle')
				},
			},
			reset: {
				name: 'Reset Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/reset')
				},
			},
			stop: {
				name: 'Stop Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/stop')
				},
			},

			// Timer Selection
			selectTimer: {
				name: 'Select Timer by Number',
				options: [
					{
						type: 'number',
						label: 'Timer Number (1-based)',
						id: 'index',
						default: 1,
						min: 1,
						max: 100,
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/timer/select', action.options.index)
				},
			},
			selectTimerByName: {
				name: 'Select Timer by Name',
				options: [
					{
						type: 'textinput',
						label: 'Timer Name',
						id: 'name',
						default: '',
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/timer/select/name', action.options.name)
				},
			},
			nextTimer: {
				name: 'Next Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/next')
				},
			},
			previousTimer: {
				name: 'Previous Timer',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/timer/previous')
				},
			},

			// Duration Control
			setDuration: {
				name: 'Set Duration (seconds)',
				options: [
					{
						type: 'number',
						label: 'Duration (seconds)',
						id: 'duration',
						default: 300,
						min: 1,
						max: 86400,
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/timer/duration', action.options.duration)
				},
			},
			addDuration: {
				name: 'Add/Subtract Duration',
				options: [
					{
						type: 'number',
						label: 'Seconds (+/-)',
						id: 'amount',
						default: 60,
						min: -3600,
						max: 3600,
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/timer/duration/add', action.options.amount)
				},
			},

			// Display Control
			blackoutOn: {
				name: 'Blackout On',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/display/blackout', 1)
				},
			},
			blackoutOff: {
				name: 'Blackout Off',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/display/blackout', 0)
				},
			},
			blackoutToggle: {
				name: 'Blackout Toggle',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/display/blackout/toggle')
				},
			},
			flash: {
				name: 'Flash Display',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/display/flash')
				},
			},

			// Message Control
			showMessage: {
				name: 'Show Message by Number',
				options: [
					{
						type: 'number',
						label: 'Message Number (1-based)',
						id: 'index',
						default: 1,
						min: 1,
						max: 100,
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/message/show', action.options.index)
				},
			},
			showMessageByText: {
				name: 'Show Message by Text',
				options: [
					{
						type: 'textinput',
						label: 'Message Text (partial match)',
						id: 'text',
						default: '',
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/message/show/text', action.options.text)
				},
			},
			hideMessage: {
				name: 'Hide Message',
				options: [],
				callback: async () => {
					self.sendOSC('/ninja/message/hide')
				},
			},

			// Profile Control
			selectProfile: {
				name: 'Select Profile by Number',
				options: [
					{
						type: 'number',
						label: 'Profile Number (1-based)',
						id: 'index',
						default: 1,
						min: 1,
						max: 100,
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/profile/select', action.options.index)
				},
			},
			selectProfileByName: {
				name: 'Select Profile by Name',
				options: [
					{
						type: 'textinput',
						label: 'Profile Name',
						id: 'name',
						default: '',
					},
				],
				callback: async (action) => {
					self.sendOSC('/ninja/profile/select/name', action.options.name)
				},
			},
		}
	},
}

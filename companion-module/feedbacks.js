const { combineRgb } = require('@companion-module/base')

module.exports = {
	getFeedbacks(self) {
		return {
			running: {
				type: 'boolean',
				name: 'Timer Running',
				description: 'Change button appearance when timer is running',
				defaultStyle: {
					bgcolor: combineRgb(0, 200, 0),
					color: combineRgb(0, 0, 0),
				},
				options: [],
				callback: () => {
					return self.state.running
				},
			},
			paused: {
				type: 'boolean',
				name: 'Timer Paused',
				description: 'Change button appearance when timer is paused',
				defaultStyle: {
					bgcolor: combineRgb(200, 200, 0),
					color: combineRgb(0, 0, 0),
				},
				options: [],
				callback: () => {
					return !self.state.running && !self.state.ended && self.state.elapsed > 0
				},
			},
			ended: {
				type: 'boolean',
				name: 'Timer Ended',
				description: 'Change button appearance when timer has ended',
				defaultStyle: {
					bgcolor: combineRgb(200, 0, 0),
					color: combineRgb(255, 255, 255),
				},
				options: [],
				callback: () => {
					return self.state.ended
				},
			},
			overtime: {
				type: 'boolean',
				name: 'Timer Overtime',
				description: 'Change button appearance when timer is in overtime',
				defaultStyle: {
					bgcolor: combineRgb(200, 0, 0),
					color: combineRgb(255, 255, 255),
				},
				options: [],
				callback: () => {
					return self.state.overtime
				},
			},
			blackout: {
				type: 'boolean',
				name: 'Blackout Active',
				description: 'Change button appearance when blackout is active',
				defaultStyle: {
					bgcolor: combineRgb(0, 0, 0),
					color: combineRgb(255, 0, 0),
				},
				options: [],
				callback: () => {
					return self.state.blackout
				},
			},
			warning: {
				type: 'boolean',
				name: 'Warning State (Yellow/Orange)',
				description: 'Change button appearance based on remaining time',
				defaultStyle: {
					bgcolor: combineRgb(255, 165, 0),
					color: combineRgb(0, 0, 0),
				},
				options: [
					{
						type: 'number',
						label: 'Warning Threshold (seconds)',
						id: 'threshold',
						default: 60,
						min: 1,
						max: 3600,
					},
				],
				callback: (feedback) => {
					return self.state.remaining > 0 && self.state.remaining <= feedback.options.threshold
				},
			},
			timerSelected: {
				type: 'boolean',
				name: 'Timer Selected',
				description: 'Change button appearance when a specific timer is selected',
				defaultStyle: {
					bgcolor: combineRgb(0, 100, 200),
					color: combineRgb(255, 255, 255),
				},
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
				callback: (feedback) => {
					return self.state.timerIndex === feedback.options.index
				},
			},
			profileSelected: {
				type: 'boolean',
				name: 'Profile Selected',
				description: 'Change button appearance when a specific profile is selected',
				defaultStyle: {
					bgcolor: combineRgb(100, 0, 200),
					color: combineRgb(255, 255, 255),
				},
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
				callback: (feedback) => {
					return self.state.profileIndex === feedback.options.index
				},
			},
		}
	},
}

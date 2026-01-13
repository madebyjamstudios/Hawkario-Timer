const { combineRgb } = require('@companion-module/base')

module.exports = {
	getPresets() {
		const presets = {}

		// Play/Pause Toggle
		presets['toggle'] = {
			type: 'button',
			category: 'Timer Control',
			name: 'Play/Pause Toggle',
			style: {
				text: 'PLAY\\nPAUSE',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [{ actionId: 'toggle' }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'running',
					style: {
						bgcolor: combineRgb(0, 200, 0),
						text: 'PAUSE',
					},
				},
				{
					feedbackId: 'paused',
					style: {
						bgcolor: combineRgb(200, 200, 0),
						text: 'RESUME',
					},
				},
			],
		}

		// Start Button
		presets['start'] = {
			type: 'button',
			category: 'Timer Control',
			name: 'Start Timer',
			style: {
				text: 'START',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 100, 0),
			},
			steps: [
				{
					down: [{ actionId: 'start' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Pause Button
		presets['pause'] = {
			type: 'button',
			category: 'Timer Control',
			name: 'Pause Timer',
			style: {
				text: 'PAUSE',
				size: '18',
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(200, 200, 0),
			},
			steps: [
				{
					down: [{ actionId: 'pause' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Reset Button
		presets['reset'] = {
			type: 'button',
			category: 'Timer Control',
			name: 'Reset Timer',
			style: {
				text: 'RESET',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(100, 100, 100),
			},
			steps: [
				{
					down: [{ actionId: 'reset' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Stop Button
		presets['stop'] = {
			type: 'button',
			category: 'Timer Control',
			name: 'Stop Timer',
			style: {
				text: 'STOP',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(200, 0, 0),
			},
			steps: [
				{
					down: [{ actionId: 'stop' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Timer Display
		presets['time_display'] = {
			type: 'button',
			category: 'Display',
			name: 'Time Display',
			style: {
				text: '$(ninja:time)',
				size: '24',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [],
			feedbacks: [
				{
					feedbackId: 'running',
					style: {
						color: combineRgb(0, 255, 0),
					},
				},
				{
					feedbackId: 'overtime',
					style: {
						color: combineRgb(255, 0, 0),
					},
				},
				{
					feedbackId: 'ended',
					style: {
						color: combineRgb(255, 0, 0),
						bgcolor: combineRgb(50, 0, 0),
					},
				},
			],
		}

		// Timer Name Display
		presets['timer_name'] = {
			type: 'button',
			category: 'Display',
			name: 'Timer Name',
			style: {
				text: '$(ninja:timer_name)',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 50),
			},
			steps: [],
			feedbacks: [],
		}

		// Blackout Toggle
		presets['blackout'] = {
			type: 'button',
			category: 'Display Control',
			name: 'Blackout Toggle',
			style: {
				text: 'BLACK\\nOUT',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(50, 50, 50),
			},
			steps: [
				{
					down: [{ actionId: 'blackoutToggle' }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'blackout',
					style: {
						bgcolor: combineRgb(0, 0, 0),
						color: combineRgb(255, 0, 0),
						text: 'BLACK\\nOUT',
					},
				},
			],
		}

		// Flash
		presets['flash'] = {
			type: 'button',
			category: 'Display Control',
			name: 'Flash Display',
			style: {
				text: 'FLASH',
				size: '18',
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 255, 0),
			},
			steps: [
				{
					down: [{ actionId: 'flash' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Next Timer
		presets['next_timer'] = {
			type: 'button',
			category: 'Timer Selection',
			name: 'Next Timer',
			style: {
				text: 'NEXT\\nTIMER',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 100),
			},
			steps: [
				{
					down: [{ actionId: 'nextTimer' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Previous Timer
		presets['prev_timer'] = {
			type: 'button',
			category: 'Timer Selection',
			name: 'Previous Timer',
			style: {
				text: 'PREV\\nTIMER',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 100),
			},
			steps: [
				{
					down: [{ actionId: 'previousTimer' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Add 1 Minute
		presets['add_1min'] = {
			type: 'button',
			category: 'Duration Control',
			name: 'Add 1 Minute',
			style: {
				text: '+1:00',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 100, 100),
			},
			steps: [
				{
					down: [{ actionId: 'addDuration', options: { amount: 60 } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Subtract 1 Minute
		presets['sub_1min'] = {
			type: 'button',
			category: 'Duration Control',
			name: 'Subtract 1 Minute',
			style: {
				text: '-1:00',
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(100, 50, 0),
			},
			steps: [
				{
					down: [{ actionId: 'addDuration', options: { amount: -60 } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Timer Select Buttons (1-5)
		for (let i = 1; i <= 5; i++) {
			presets[`timer_${i}`] = {
				type: 'button',
				category: 'Timer Selection',
				name: `Select Timer ${i}`,
				style: {
					text: `Timer\\n${i}`,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 50, 100),
				},
				steps: [
					{
						down: [{ actionId: 'selectTimer', options: { index: i } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'timerSelected',
						options: { index: i },
						style: {
							bgcolor: combineRgb(0, 100, 200),
						},
					},
				],
			}
		}

		// Hide Message
		presets['hide_message'] = {
			type: 'button',
			category: 'Messages',
			name: 'Hide Message',
			style: {
				text: 'HIDE\\nMSG',
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(100, 0, 0),
			},
			steps: [
				{
					down: [{ actionId: 'hideMessage' }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Show Message Buttons (1-3)
		for (let i = 1; i <= 3; i++) {
			presets[`message_${i}`] = {
				type: 'button',
				category: 'Messages',
				name: `Show Message ${i}`,
				style: {
					text: `MSG\\n${i}`,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(100, 0, 100),
				},
				steps: [
					{
						down: [{ actionId: 'showMessage', options: { index: i } }],
						up: [],
					},
				],
				feedbacks: [],
			}
		}

		return presets
	},
}

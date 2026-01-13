module.exports = {
	getVariables() {
		return [
			{
				variableId: 'time',
				name: 'Current Time Display',
			},
			{
				variableId: 'remaining',
				name: 'Seconds Remaining',
			},
			{
				variableId: 'elapsed',
				name: 'Seconds Elapsed',
			},
			{
				variableId: 'progress',
				name: 'Progress Percentage (0-100)',
			},
			{
				variableId: 'timer_name',
				name: 'Active Timer Name',
			},
			{
				variableId: 'timer_index',
				name: 'Active Timer Number',
			},
			{
				variableId: 'profile_name',
				name: 'Active Profile Name',
			},
			{
				variableId: 'profile_index',
				name: 'Active Profile Number',
			},
			{
				variableId: 'state',
				name: 'Timer State (Running/Stopped/Ended)',
			},
		]
	},
}

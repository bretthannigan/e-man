# e-man
Slack app and web interface for managing equipment usage.

## Equipment Manager Instructions for Use

The following 4 actions are slash commands done in Slack. Type a forward slash and begin typing the command into the text area to see an auto-complete list of supported commands.

### Querying equipment

From any channel in the menrva-sfu Slack workspace, type the command:
`/eman-query [asset-number]`
Where `[asset-number]` is the equipment tracking number. Don’t know the number? Either look at the web page here or use the search function below. If found, you will get a summary of the equipment that looks like this:

### Searching equipment

From any channel in the menrva-sfu Slack workspace, type the command:
`/eman-search [keyword]`
Where `[keyword]` matches the nickname, full name, manufacturer, model, serial number, or specific location. The tool then returns the top 5 matches, if found, in a format similar to the previous command.

### Checking out equipment

From the equipment channel in the menrva-sfu Slack workspace, type the command:
`/eman-checkout [asset-number] (number-of-days)`
Where `[asset-number]` is the equipment tracking number and `(number-of-days)` is an optional parameter to specify the number of days you want to reserve the equipment for.

### Checking in equipment

From the equipment channel in the menrva-sfu Slack workspace, type the command:
`/eman-checkin [asset-number]`
Where `[asset-number]` is the equipment tracking number.

### Adding new equipment

Adding new equipment entries must be done from the web dashboard. Sign in and complete the fields in the first row of the “List of Assets” table. Make sure the “Asset number” is unique and click the “Add” button.

### Deleting equipment

Deleting equipment entries must be done from the web dashboard. Sign in and find the table row that has the equipment that is no longer necessary. Press the delete button. Note: there is no confirmation upon delete!

### Modifying equipment details

Modifying equipment entries must be done from the web dashboard. Sign in and find the table row that has the equipment that is to be modified. Press the edit button, correct the field(s), and press the Save button once done. Note that the “Asset number” must be unique – if you change the asset number to an unused value, a copy of the entry is made with the new asset number. If you change it to an occupied value it will overwrite that entry.

## Future 

The following features are not yet implemented but may be in the future:
-	Setting equipment status to Unknown / Out of Service / Missing from Slack.
-	Slack reminders when your equipment is due back.
-	History tracking of equipment status, user, location, etc.

## Bugs & Features

Please let me know if you have any feature requests or encounter any bugs by sending an e-mail or clicking the link at the bottom of the web page. If you’re interested, the source code is here.

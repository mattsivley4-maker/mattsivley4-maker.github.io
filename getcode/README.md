# Get Code enrollment reminder

Published from main through the existing GitHub Pages workflow.

- Base picker: https://www.makersatx.com/getcode/
- San Antonio: https://mattsivley4-maker.github.io/getcode/?code=11409&name=San+Antonio
- Frio: https://mattsivley4-maker.github.io/getcode/?code=11408&name=Frio
- Link and QR maker: https://www.makersatx.com/getcode/?make

The maker is unlisted, not password-protected. It creates links and labeled PNG QR images entirely in the browser.

Add future bases to the BASES list at the start of the application script in index.html. Existing links support other numeric codes and base names without editing the list.

All enrollment buttons point to https://www.amcnrep.com/Matthew-Sivley.
This page reminds visitors to enter a Get Code, not Track Code 15592.
The homepage, /airmedcare/ Track Code page, CNAME, and deployment workflow are unchanged.

Printable PNGs in this folder:
- get-code-san-antonio-11409.png
- get-code-frio-11408.png
- get-code-choose-base.png

All three QR images encode the github.io address. Keeping that GitHub account and repository available is required for these links to remain usable. If the custom domain is removed, remove it from the GitHub Pages domain configuration as well.

Validation before publishing:
- San Antonio and Frio reminder screens and base picker
- Disabled enrollment control until checkbox is checked; re-lock on uncheck
- Copy action, maker link, QR preview, and PNG download
- Phone layout scrolls without horizontal overflow
- No browser console errors observed
- Saved PNGs and browser-downloaded QR decoded independently to the intended URLs

The QR generator by Kazuhiko Arase is bundled in index.html with its MIT license.

# Overview

This repo contains scraping scripts for ideascrape

## TO IMPROVE

- Better logging
- Handle force stop in all
- Change scrape outputs to camelcase
- AIFT daily scrape should only scrape the month
- Standardize data variable names with sql table

## How to handle force stop

- Have a boolean to track if force stop has been invoked
- Register graceful exit to set that boolean to true
- In for loop, check for that boolean. If so, throw an error. keep throwing errors until program stops fully
- Have `process.exit()` at the end

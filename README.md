# Overview

This repo contains scraping scripts for ideascrape

## Set up

- Create a .env file with an env variable for master out folder `MASTER_OUT_FOLDER=<INSERT PATH HERE>`
- Do the same in `/python_scripts` but also with `OPENAI_API_KEY`

## How to scrape PH

- Run scrape-homefeed, will scrape ph homefeeds from yesterday until a certain day as controlled by inputs

## How to scrape AIFT

- Run scrape-lists with appropriate list
- Run extract-post-urls latest or all
- Run scrape-posts with latest or all

## TO IMPROVE

- Better logging
  - Make it clear what scraper is doing what
- Handle force stop in all
- Change scrape outputs to camelcase
- AIFT daily scrape should only scrape the month
- Standardize data variable names with sql table

## How to handle force stop

- Have a boolean to track if force stop has been invoked
- Register graceful exit to set that boolean to true
- In for loop, check for that boolean. If so, throw an error. keep throwing errors until program stops fully
- Have `process.exit()` at the end

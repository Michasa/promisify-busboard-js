import {
    createInterface
} from 'readline';
import {
    URL
} from 'url';
import request from 'request';
import Promise from 'promise';

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const POSTCODES_BASE_URL = 'https://api.postcodes.io';
const TFL_BASE_URL = 'https://api.tfl.gov.uk';

export default class ConsoleRunner {

    promptForPostcode() {
        return new Promise((resolve, reject) => {
            readline.question("\nEnter your postcode: ", function (postcode) {
                readline.close();
                if (resolve) {
                    resolve(postcode.replace(/\s/g, ""));
                } else {
                    reject(`ERROR! ${postcode} is not a valid postcode`)
                }
            });
        });
    }

    displayStopPoints(stopPoints) {
        stopPoints.forEach(point => {
            console.log(point.commonName);
        });
    }

    buildUrl(url, endpoint, parameters) {
        const requestUrl = new URL(endpoint, url);
        parameters.forEach(param => requestUrl.searchParams.append(param.name, param.value));
        return requestUrl.href;
    }

    makeGetRequest(baseUrl, endpoint, parameters) {
        return new Promise((resolve, reject) => {
            const url = this.buildUrl(baseUrl, endpoint, parameters);

            request.get(url, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode !== 200) {
                    reject(response.statusCode);
                } else {
                    resolve(body);
                }
            });
        });
    }

    getLocationForPostCode(postcode) {
        return new Promise((resolve, reject) => {
            this.makeGetRequest(POSTCODES_BASE_URL, `postcodes/${postcode}`, []).then(
                responseBody => {
                    const jsonBody = JSON.parse(responseBody);
                    if (resolve) {
                        resolve({
                            latitude: jsonBody.result.latitude,
                            longitude: jsonBody.result.longitude
                        });
                    } else {
                        reject(`ERROR! Location co-ordinates could not be deceiphered for given postcode ${postcode}`);
                    }
                });
        });
    }
    getNearestStopPoints(latitude, longitude, count) {
        return new Promise((resolve, reject) => {
            this.makeGetRequest(
                TFL_BASE_URL,
                `StopPoint`, [{
                        name: 'stopTypes',
                        value: 'NaptanPublicBusCoachTram'
                    },
                    {
                        name: 'lat',
                        value: latitude
                    },
                    {
                        name: 'lon',
                        value: longitude
                    },
                    {
                        name: 'radius',
                        value: 1000
                    },
                    {
                        name: 'app_id',
                        value: '' /* Enter your app id here */
                    },
                    {
                        name: 'app_key',
                        value: '' /* Enter your app key here */
                    }
                ]).then(responseBody => {
                const stopPoints = JSON.parse(responseBody).stopPoints.map(function (entity) {
                    return {
                        naptanId: entity.naptanId,
                        commonName: entity.commonName
                    };
                }).slice(0, count);
                if (resolve === false) {
                    resolve(stopPoints);
                } else {
                    reject("ERROR! Could not find any nearby bus stops for this location")
                }
            });
        })
    }

    run() {
        const that = this;
        const asyncpromise1 = that.promptForPostcode()
        const asyncpromise2 = asyncpromise1.then((postcode) => {
            return that.getLocationForPostCode(postcode);
        })
        const asyncpromise3 = asyncpromise2.then((location) => {
            return that.getNearestStopPoints(location.latitude, location.longitude, 5);
        })
        const asyncpromise4 = asyncpromise3.then((stopPoints) => {
            that.displayStopPoints(stopPoints);
        })

        Promise.all([asyncpromise1, asyncpromise2, asyncpromise3]).then(function (result) {
            return asyncpromise4
        })
    }
}
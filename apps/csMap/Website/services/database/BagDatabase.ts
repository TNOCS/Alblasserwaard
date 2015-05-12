import express              = require('express');
import ConfigurationService = require('../configuration/ConfigurationService');
import pg                   = require('pg');

/**
 * Export a connection to the BAG database.
 */
class BagDatabase {
    private connectionString: string;

    constructor(config: ConfigurationService) {
        this.connectionString = process.env.DATABASE_URL || config["bagConnectionString"];
    }

    private query(client: pg.Client, res: express.Response, sql: string) {
        var results: Object[] = [];
        // SQL Query > Select Data
        var query = client.query(sql);

        // Stream results back one row at a time
        query.on('row', function(row) {
            results.push(row);
        });

        // After all data is returned, close connection and return results
        query.on('end', function() {
            client.end();
            return res.json(results);
        });

        // Handle Errors
        query.on('error', function(err) {
            console.log(err);
        });

    }

    private formatZipCode(zipCode: string) {
        if (!zipCode)
            return null;
        var formattedZipCode = zipCode.replace(/ /g, '').toUpperCase();
        if (formattedZipCode.length < 6)
            return;

        if (formattedZipCode.length == 6) {
            return formattedZipCode;
        } else {
            return null;
        }
    }

    private formatHouseNumber(houseNumber: string) {
		if (!houseNumber) return null;
		var formattedHouseNumber = houseNumber.replace(/^\D+|\D.*$/g, "");
		if (!formattedHouseNumber) {
			return null;
		} else {
			return +formattedHouseNumber;
		}
	}

    public lookupAddress(req: express.Request, res: express.Response) {
        // Get a Postgres client from the connection pool
        var zipCode: string = this.formatZipCode(req.params.zip);
        if (!zipCode) return res.send(400, 'zip code is missing');
        var houseNumber: number = this.formatHouseNumber(req.params.number);
        if (!houseNumber) return res.send(400, 'house number is missing');

        pg.connect(this.connectionString, (err, client, done) => {
            var sql = `SELECT openbareruimtenaam, huisnummer, huisletter, huisnummertoevoeging, gemeentenaam, provincienaam, ST_X(ST_Transform(geopunt, 4326)) as lon, ST_Y(ST_Transform(geopunt, 4326)) as lat FROM adres WHERE adres.postcode='${zipCode}' AND adres.huisnummer=${houseNumber}`;
            this.query(client, res, sql);
        });
    }

}
export = BagDatabase;

import express              = require('express');
import http                 = require('http');
import path                 = require('path');
import offlineSearch        = require('cs-offline-search');
import cc                   = require("./ClientConnection");
import MapLayerFactory      = require('./services/MapLayerCreator/MapLayerFactory');
import fr                   = require("./layers/FlightRadar");
import DataSource           = require("./sensors/DataSource");
import MessageBus           = require('./services/bus/MessageBus');
import BagDatabase          = require('./services/database/BagDatabase');
import ConfigurationService = require('./services/configuration/ConfigurationService');

/**
 * Create a search index file which can be loaded statically.
 */
var offlineSearchManager = new offlineSearch('public/data/projects/projects.json', {
    propertyNames: ['Name', 'plaatnaam', 'postcode', 'Postcode', 'straat', 'loc_straat', 'KvK', 'gemeente', 'plaats', 'Naam_van_het_concern_DigiMV_2012'],
    stopWords    : ['de', 'het', 'een', 'en', 'van', 'aan']
});

// setup socket.io object
var server        = express();
var httpServer    = require('http').Server(server);
var cm            = new cc.ConnectionManager(httpServer);
var messageBus    = new MessageBus();
var config = new ConfigurationService('./configuration.json');

// all environments
server.set('port', '3002');
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'jade');
server.use(express.favicon());
server.use(express.logger('dev'));
server.use(express.json());
server.use(express.urlencoded());
server.use(express.methodOverride());
server.use(server.router);

var planes = new fr.FlightRadar(cm, "FlightRadar");
planes.Start();
server.get("/fr", planes.GetLayer);

var ds = new DataSource.DataSourceService(cm,"DataSource");
ds.Start();
server.get("/datasource", ds.GetDataSource);

var bagDatabase = new BagDatabase(config);
server.get(config["resolveAddress"], (req, res) => bagDatabase.lookupAddress(req, res));

var mapLayerFactory = new MapLayerFactory(config, messageBus);
server.post('/projecttemplate', (req, res) => mapLayerFactory.process(req, res));

server.use(express.static(path.join(__dirname, 'public')));
console.log("started");

// development only
if ('development' == server.get('env')) {
    server.use(express.errorHandler());
}

//server.get('/', (req, res) => {
//    res.render('index.html');
//});
//server.get('/', routes.index);
//server.get('/users', user.list);

httpServer.listen(server.get('port'),() => {
    console.log('Express server listening on port ' + server.get('port'));
});

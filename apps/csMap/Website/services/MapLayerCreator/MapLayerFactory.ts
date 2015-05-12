import express    = require('express');
import MessageBus = require('../bus/MessageBus');
import ConfigurationService = require('../configuration/ConfigurationService');

interface ILayerDefinition {
    reference:     string;
    group:         string;
    title:         string;
    description:   string;
    geometryType:  string;
    parameter1:    string;
    parameter2:    string;
    parameter3:    string;
    iconUri:       string;
    iconSize:      number;
    fillColor:     string;
    strokeColor:   string;
    strokeWidth:   number;
    isEnabled:     boolean;
    useClustering: boolean;
    opacity: number;
}

interface ILayerTemplate {
    layerDefinition: ILayerDefinition;
    propertyTypes:   csComp.Services.IPropertyType[];
    properties: csComp.Services.IProperty[];
}

/** A factory class to create new map layers based on input, e.g. from Excel */
class MapLayerFactory {
    constructor(private configService: ConfigurationService, private messageBus: MessageBus) {}

    public process(req: express.Request, res: express.Response) {
        console.log('POST /');
        var geojson = MapLayerFactory.createMapLayer(req.body);
        this.messageBus.publish('dynamic_project_layer', 'created', {
            project : "test",
            id : "",
            geojson : geojson,
            enabled : true });
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('');
    }

    public static createMapLayer(template: ILayerTemplate) {
        // Convert layerTemplate to ProjectLayer
        // var projectLayer: csComp.Services.IProjectLayer = {
        //     title: layerTemplate.layerDefinition.title,
        //     type: 'geojson',
        //     url: '',
        //     group: layerTemplate.layerDefinition.group
        //
        // };
        var ld = template.layerDefinition;
        var features: csComp.Services.IFeature[] = [];
        var geojson: csComp.Services.IGeoJsonFile = {
            type: "FeatureCollection",
            featureTypes: {
                "Default": {
                    name: "Default",
                    style: {
                        stroke: ld.strokeWidth > 0,
                        strokeColor: ld.strokeColor || "black",
                        fillColor: ld.fillColor || "yellow",
                        opacity: ld.opacity || 0.5,
                        fillOpacity: ld.opacity || 0.5
                    },
                    propertyTypeData: template.properties
                }
            },
            features: features
        };

        // Add geometry
        return null;
    }
}
export = MapLayerFactory;

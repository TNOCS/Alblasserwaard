﻿module FeatureProps {
    import IFeature          = csComp.Services.IFeature;
    import IFeatureType      = csComp.Services.IFeatureType;
    import IPropertyType     = csComp.Services.IPropertyType;
    import IPropertyTypeData = csComp.Services.IPropertyTypeData;

    class FeaturePropsOptions implements L.SidebarOptions {
        public position   : string;
        public closeButton: boolean;
        public autoPan    : boolean;

        constructor(position: string) {
            this.position    = position;
            this.closeButton = true;
            this.autoPan     = true;
        }
    }

    export interface IFeaturePropsScope extends ng.IScope {
        vm                              : FeaturePropsCtrl;
        showMenu                        : boolean;
        poi                             : IFeature;
        callOut                         : CallOut;
        tabs                            : JQuery;
        tabScrollDelta                  : number;
        featureTabActivated(sectionTitle: string, section: CallOutSection);
        autocollapse(init: boolean)     : void;
    }

    export interface ICallOutProperty {
        key         : string;
        value       : string;
        property    : string;
        canFilter   : boolean;
        canStyle    : boolean;
        feature     : IFeature;
        description?: string;
        meta?: IPropertyType;
        isFilter    : boolean;
    }

    export class CallOutProperty implements ICallOutProperty {
        constructor(
            public key         : string,
            public value       : string,
            public property    : string,
            public canFilter   : boolean,
            public canStyle    : boolean,
            public feature     : IFeature,
            public isFilter    : boolean,
            public isSensor    : boolean,
            public description?: string,
            public meta?       : IPropertyType,
            public timestamps? : number[],
            public sensor?     : number[]) { }
    }

    export interface ICallOutSection {
        propertyTypes: { [label: string]: IPropertyType }; // Probably not needed
        properties     : Array<ICallOutProperty>;
        sectionIcon    : string;
        addProperty(key: string, value: string, property: string, canFilter: boolean, canStyle: boolean, feature: IFeature, isFilter: boolean, description?: string, meta?: IPropertyType) : void;
        hasProperties(): boolean;
    }

    export class CallOutSection implements ICallOutSection {
        propertyTypes: { [label: string]: IPropertyType };
        properties   : Array<ICallOutProperty>;
        sectionIcon  : string;

        constructor(sectionIcon?: string) {
            this.propertyTypes   = {};
            this.properties      = [];
            this.sectionIcon     = sectionIcon;
        }

        showSectionIcon(): boolean { return !csComp.StringExt.isNullOrEmpty(this.sectionIcon); }

        addProperty(key: string, value: string, property: string, canFilter: boolean, canStyle: boolean, feature: IFeature, isFilter: boolean, description?: string, meta?: IPropertyType ): void {
            var isSensor = typeof feature.sensors !== 'undefined' && feature.sensors.hasOwnProperty(property);
            if (isSensor)
                this.properties.push(new CallOutProperty(key, value, property, canFilter, canStyle, feature, isFilter, isSensor, description ? description : null, meta, feature.timestamps, feature.sensors[property]));
            else
                this.properties.push(new CallOutProperty(key, value, property, canFilter, canStyle, feature, isFilter, isSensor, description ? description : null, meta));
        }

        hasProperties(): boolean {
            return this.properties != null && this.properties.length > 0;
        }
    }

    declare var String;

    export class CallOut {
        public title   : string;
        public icon    : string;
        public sections: { [title: string]: ICallOutSection; };

        constructor(private type: IFeatureType, private feature: IFeature, private propertyTypeData: IPropertyTypeData, private layerservice: csComp.Services.LayerService ) {
            this.sections = {};
            //if (type == null) this.createDefaultType();
            this.setTitle();
            this.setIcon(feature);

            var infoCallOutSection   = new CallOutSection('fa-info');
            var searchCallOutSection = new CallOutSection('fa-filter');
            var hierarchyCallOutSection = new CallOutSection('fa-link');

            var displayValue: string;
            if (type != null) {
                var propertyTypes = csComp.Helpers.getPropertyTypes(type, propertyTypeData);
                propertyTypes.forEach((mi: IPropertyType) => {
                    var callOutSection = this.getOrCreateCallOutSection(mi.section) || infoCallOutSection;
                    callOutSection.propertyTypes[mi.label] = mi;
                    var text = feature.properties[mi.label]; if (mi.type === "hierarchy") {
                    var count = this.calculateHierarchyValue(mi, feature, propertyTypeData, layerservice);
                        text = count + ";" + feature.properties[mi.calculation];
                    }
                    displayValue = csComp.Helpers.convertPropertyInfo(mi, text);
                    // Skip empty, non-editable values
                    if (!mi.canEdit && csComp.StringExt.isNullOrEmpty(displayValue)) return;

                    var canFilter = (mi.type === "number" || mi.type === "text"    || mi.type === "options");
                    var canStyle  = (mi.type === "number" || mi.type === "options" || mi.type === "color");
                    if (mi.filterType != null) canFilter = mi.filterType.toLowerCase() != "none";
                    if (mi.visibleInCallOut)
                    {
                        callOutSection.addProperty(mi.title, displayValue, mi.label, canFilter, canStyle, feature, false, mi.description, mi);
                    }
                    if (mi.type === "hierarchy") {
                        hierarchyCallOutSection.addProperty(mi.title, displayValue, mi.label, canFilter, canStyle, feature, false, mi.description, mi);
                    }
                    searchCallOutSection.addProperty(mi.title, displayValue, mi.label, canFilter, canStyle, feature, false, mi.description);
                });
            }
            if (infoCallOutSection.properties.length > 0) this.sections['AAA Info'] = infoCallOutSection; // The AAA is added as the sections are sorted alphabetically
            if (hierarchyCallOutSection.properties.length > 0) this.sections['hierarchy'] = hierarchyCallOutSection;
            if (searchCallOutSection.properties.length > 0) this.sections['zzz Search'] = searchCallOutSection;
        }

        private calculateHierarchyValue(mi: IPropertyType, feature: IFeature, propertyTypeData: IPropertyTypeData, layerservice: csComp.Services.LayerService): number {
            var countResults = [];
            var result: number = -1;
            var propertyTypes = csComp.Helpers.getPropertyTypes(feature.fType, propertyTypeData);
            for (var p in propertyTypes) {
                var pt = propertyTypes[p];
                if (pt.type === "relation" && mi.targetrelation === pt.label) {
                    countResults[pt.label] = pt.count;
                    if (mi.calculation === "count") {
                        result = pt.count;
                    }
                }
            }

            if (mi.calculation === "ratio") {
                var featureName = feature.properties[mi.subject];
                layerservice.project.features.forEach((f: csComp.Services.IFeature) => {
                    if (f.properties.hasOwnProperty(mi.target) && f.properties[mi.target] === featureName) {
                        if (f.properties.hasOwnProperty(mi.targetproperty)) {
                            result = +f.properties[mi.targetproperty] / countResults[mi.targetrelation];
                        }
                    }
                });
            }
            return result;
        }

        public sectionCount(): number {
            return Object.keys(this.sections).length;
        }

        public firstSection(): ICallOutSection {
            //Return first section that has an icon
            //TODO: Swap locations
            var firstSec;
            for (var i = 0; i < (this.sectionCount() - 1); i++) {
                if (this.sections[Object.keys(this.sections)[i]].sectionIcon) {
                    firstSec = this.sections[Object.keys(this.sections)[i]];
                    break;
                }
            }
            return firstSec;
        }

        public lastSection(): ICallOutSection {
            return this.sections[Object.keys(this.sections)[this.sectionCount()-1]];
        }

        private getOrCreateCallOutSection(sectionTitle: string): ICallOutSection {
            if (!sectionTitle) {
                return null;
            }
            if (sectionTitle in this.sections)
                return this.sections[sectionTitle];
            this.sections[sectionTitle] = new CallOutSection();
            return this.sections[sectionTitle];
        }

        /**
         * Set the title of the callout to the title of the feature.
         */
        private setTitle() {
            this.title = CallOut.title(this.type, this.feature);
        }

        private setIcon(feature: csComp.Services.IFeature) {
            this.icon = (this.type == null || this.type.style == null || !this.type.style.hasOwnProperty('iconUri') || this.type.style.iconUri.toLowerCase().indexOf('_media') >= 0)
                ? ''
                : this.type.style.iconUri.indexOf('{') >= 0
                    ? csComp.Helpers.convertStringFormat(feature, this.type.style.iconUri)
                    : this.type.style.iconUri;
        }

        public static title(type: IFeatureType, feature: IFeature): string {
            var title = '';
            if (type != null && type.style != null && type.style.nameLabel)
                title = feature.properties[type.style.nameLabel];
            else {
                if (feature.properties.hasOwnProperty('Name')) title = feature.properties['Name'];
                else if (feature.properties.hasOwnProperty('name')) title = feature.properties['name'];
                else if (feature.properties.hasOwnProperty('naam')) title = feature.properties['naam'];
            }
            if (!csComp.StringExt.isNullOrEmpty(title) && !$.isNumeric(title))
                title = title.replace(/&amp;/g, '&');
            return title;
        }
    }

    export class FeaturePropsCtrl {
        private scope: IFeaturePropsScope;

        // $inject annotation.
        // It provides $injector with information about dependencies to be injected into constructor
        // it is better to have it close to the constructor, because the parameters must match in count and type.
        // See http://docs.angularjs.org/guide/di
        public static $inject = [
            '$scope',
            '$location',
            '$sce',
            'mapService',
            'layerService',
            'messageBusService'
        ];

        // dependencies are injected via AngularJS $injector
        // controller's name is registered in Application.ts and specified from ng-controller attribute in index.html
        constructor(
            private $scope             : IFeaturePropsScope,
            private $location          : ng.ILocationService,
            private $sce               : ng.ISCEService,
            private $mapService        : csComp.Services.MapService,
            private $layerService      : csComp.Services.LayerService,
            private $messageBusService : csComp.Services.MessageBusService
            ) {
            this.scope = $scope;
            $scope.vm = this;
            $scope.showMenu = false;

            $scope.featureTabActivated = function (sectionTitle: string, section: CallOutSection) {
                $messageBusService.publish('FeatureTab', 'activated', { sectionTitle: sectionTitle, section: section });
            };

            $messageBusService.subscribe("sidebar", this.sidebarMessageReceived);
            $messageBusService.subscribe("feature", this.featureMessageReceived);

            var widthOfList = function () {
                var itemsWidth = 0;
                $('#featureTabs>li').each(function () {
                    var itemWidth = $(this).outerWidth();

                    itemsWidth += itemWidth;
                });
                return itemsWidth;
            }

            $scope.autocollapse = function (initializeTabPosition = false) {
                //                console.log('autocollapse');
                var tabs = $('#featureTabs');

                //                console.log('#ft.ow(): ' + tabs.outerWidth());
                //                console.log('wol: ' + widthOfList());
                //                console.log('ml: ' + tabs.css('margin-left'));

                if (tabs.outerWidth() < widthOfList() || parseFloat(tabs.css('margin-left')) < 0) {
                    $('#leftArr').show();
                    $('#rightArr').show();
                    if (initializeTabPosition) {
                        tabs.animate({ 'margin-left': '20px' }, 'slow');
                    }
                } else {
                    $('#leftArr').hide();
                    $('#rightArr').hide();
                    if (initializeTabPosition) {
                        tabs.animate({ 'margin-left': '0px' }, 'slow');
                    }
                }
            };

            $scope.autocollapse(true); // when document first loads
            $scope.tabs = $('#featureTabs');
            $scope.tabScrollDelta = $scope.tabs.outerWidth();

            $('#leftArr').click(function () {
                //console.log('leftArr');
                //var tabs = $('#featureTabs');
                var current = parseFloat($scope.tabs.css('margin-left'));
                var min = 20;
                var nextPos = $scope.tabScrollDelta;

                if (current + nextPos > min) {
                    nextPos = min - current;
                }

                $scope.tabs.animate({ 'margin-left': '+=' + nextPos + 'px' }, 'slow', function () {
                    //                    console.log('rightarr hide');
                    $('#rightArr').show();
                    $('#leftArr').show();
                    $scope.autocollapse(false);
                });
            });

            $('#rightArr').click(function () {
                //var tabs = $('#featureTabs');
                var max = widthOfList() - $scope.tabs.outerWidth() + 30;
                //var current = Math.abs(parseFloat($scope.tabs.css('margin-left')));
                var nextPos = $scope.tabScrollDelta;
                nextPos = Math.min(max, nextPos);

                $scope.tabs.animate({ 'margin-left': '-=' + nextPos + 'px' }, 'slow', function () {
                    $('#leftArr').show();
                    $('#rightArr').show();

                    $scope.autocollapse(false);
                });
            });
        }

        public toTrusted(html: string): string {
            try {
                if (html === undefined || html === null)
                    return this.$sce.trustAsHtml(html);
                return this.$sce.trustAsHtml(html.toString());
            } catch (e) {
                console.log(e + ': ' + html);
                return '';
            }
        }

        public openLayer(property : FeatureProps.CallOutProperty){
          if (property.feature!=null && property.feature.properties.hasOwnProperty(property.meta.label))
          {
            var link = property.feature.properties[property.meta.label];
            alert(link);
          }

        }

        public createScatter(property: FeatureProps.CallOutProperty) {
            var sc = new csComp.Services.GroupFilter();
            sc.property = property.property;
            sc.property2 = "opp_land";
            sc.id = csComp.Helpers.getGuid();
            sc.filterType = "scatter";
            sc.title = sc.property;
            var l = this.$layerService.findLayer(this.$scope.poi.layerId);
            this.$layerService.setFilter(sc,l.group);
            //alert('scatter ' + property.property);
        }

        /**
         * Callback function
         * @see {http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript}
         * @see {http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback}
         * @todo {notice the strange syntax using a fat arrow =>, which is to preserve the this reference in a callback!}
         */
        private sidebarMessageReceived = (title: string): void => {
            //console.log("sidebarMessageReceived");
            switch (title) {
                case "toggle":
                    this.$scope.showMenu = !this.$scope.showMenu;
                    break;
                case "show":
                    this.$scope.showMenu = true;
                    break;
                case "hide":
                    this.$scope.showMenu = false;
                    break;
                default:
            }
            // NOTE EV: You need to call apply only when an event is received outside the angular scope.
            // However, make sure you are not calling this inside an angular apply cycle, as it will generate an error.
            if (this.$scope.$root.$$phase != '$apply' && this.$scope.$root.$$phase != '$digest') {
                this.$scope.$apply();
            }
        }

        private featureMessageReceived = (title: string, feature: IFeature): void => {
            //console.log("FPC: featureMessageReceived");
            switch (title) {
                case "onFeatureSelect":
                    break;
                case "onRelationsUpdated":
                    this.setShowSimpleTimeline();
                    this.displayFeature(feature);
                    this.updateHierarchyLinks(feature);
                    this.$scope.poi = feature;
                    this.$scope.autocollapse(true);
                    break;
                case "onFeatureUpdated":
                    this.displayFeature(this.$layerService.lastSelectedFeature);
                    this.$scope.poi = this.$layerService.lastSelectedFeature;
                break;
               default:
            }
            if (this.$scope.$root.$$phase != '$apply' && this.$scope.$root.$$phase != '$digest') {
                this.$scope.$apply();
            }
        }

        private displayFeature(feature: IFeature): void {
            if (!feature) return;
            var featureType = feature.fType;
            // If we are dealing with a sensor, make sure that the feature's timestamps are valid so we can add it to a chart
            if (typeof feature.sensors !== 'undefined' && typeof feature.timestamps === 'undefined')
                feature.timestamps = this.$layerService.findLayer(feature.layerId).timestamps;
            this.$scope.callOut = new CallOut(featureType, feature, this.$layerService.propertyTypeData, this.$layerService);
        }

        private updateHierarchyLinks(feature: IFeature): void {
            if (!feature) return;
            // Add properties defined inside of layers to the project-wide properties. 
            this.$layerService.project.groups.forEach((group) => {
                group.layers.forEach((l) => {
                    if (l.type == "hierarchy" && l.enabled) {
                        if ((<any>(l.data)) && (<any>(l.data)).features) {
                            (<any>(l.data)).features[0].fType.propertyTypeData.forEach((pt) => {
                                if (pt.type == "hierarchy") {
                                    if (pt.targetlayer == feature.layerId) {
                                        var featureType = this.$layerService.featureTypes[feature.featureTypeName];
                                        var propertyTypes = csComp.Helpers.getPropertyTypes(feature.fType, this.$layerService.propertyTypeData);
                                        var found = false;
                                        propertyTypes.forEach((p) => {
                                            if (p.label === pt.label) {
                                                found = true;
                                            }
                                        });
                                        if (!found) featureType.propertyTypeData.push(pt);
                                    }
                                }
                            });
                        }
                    }
                });
            });
            csComp.Helpers.getPropertyTypes
        }

        showSensorData(property: ICallOutProperty) {
            console.log(property);
        }

        timestamps = new Array<{ title: string; timestamp: number }>();
        showSimpleTimeline: boolean;
        focusTime         : string;

        setShowSimpleTimeline() {
            if (this.$mapService.timelineVisible
                || typeof this.$layerService.lastSelectedFeature === 'undefined'
                || this.$layerService.lastSelectedFeature == null) {
                this.showSimpleTimeline = false;
                return;
            }
            var feature = this.$layerService.lastSelectedFeature;
            this.showSimpleTimeline = (typeof feature.sensors !== 'undefined' && feature.sensors !== null);
            if (this.showSimpleTimeline) this.setTimestamps();
        }

        setTimestamps() {
            var feature = this.$layerService.lastSelectedFeature;
            var layer = this.$layerService.findLayer(feature.layerId);
            if ((typeof layer.timestamps === 'undefined' || layer.timestamps == null) &&
                (typeof feature.timestamps === 'undefined' || feature.timestamps == null)) return [];
            var time = this.timestamps = new Array<{ title: string; timestamp: number }>();
            (layer.timestamps || feature.timestamps).forEach((ts) => {
                var date = new Date(ts);
                var dateString = String.format("{0}-{1:00}-{2:00}", date.getFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
                if (date.getUTCHours() > 0 || date.getUTCMinutes() > 0)
                    dateString += String.format(" {0:00}:{1:00}", date.getUTCHours(), date.getUTCMinutes());
                time.push({ title: dateString, timestamp: ts} );
            });

            // Set focus time
            var focus = this.$layerService.project.timeLine.focus;
            if (focus > time[time.length - 1].timestamp) {
                this.focusTime = time[time.length - 1].title;
                this.setTime(time[time.length - 1]);
            } else if (focus < time[0].timestamp) {
                this.focusTime = time[0].title;
                this.setTime(time[0]);
            }
            else {
                for (var i = 1; i < time.length; i++) {
                    if (focus > time[i].timestamp) continue;
                    this.focusTime = time[i].title;
                    this.setTime(time[i]);
                    break;
                }
            }
            return time;
        }

        setTime(time: { title: string; timestamp: number} ) {
            this.focusTime = time.title;
            this.$layerService.project.timeLine.setFocus(new Date(time.timestamp));
            this.$messageBusService.publish("timeline", "focusChange", time.timestamp);
        }
    }
}

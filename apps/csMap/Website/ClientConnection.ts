import io = require('socket.io');

module ClientConnection {
    export class IDynamicLayer {
        Connection: ClientConnection.ConnectionManager;
        GetLayer: Function;
        GetDataSource: Function;
        layerId: string;
    }

    export class ClientSubscription {
        public id: string;
        public type: string;
        public target: string;
    }

    export class ClientMessage {
        constructor(public action: string, public data: any) { }
    }

    export class WebClient {
        public Name: string;
        public Subscriptions: { [key: string]: ClientSubscription } = {};

        constructor(public Client: any) {
        }

        public FindSubscription(target: string, type: string): ClientSubscription {
            for (var k in this.Subscriptions) {
                if (this.Subscriptions[k].target == target && this.Subscriptions[k].type == type) return this.Subscriptions[k];
            }
            return null;
        }

        public Subscribe(sub: ClientSubscription) {
            this.Subscriptions[sub.id] = sub;
            this.Client.on(sub.id, (data) => {
                switch (data.action) {
                    case "unsubscribe":
                        console.log('unsubscribed');
                        break;
                }
            });
            this.Client.emit(sub.id, new ClientMessage("subscribed", ""));
            console.log('subscribed to : ' + sub.target + " (" + sub.type + ")");
        }
    }

    export class ConnectionManager {
        private users: { [key: string]: WebClient } = {};
        private server: SocketIO.Server;

        constructor(httpServer: any) {
            this.server = io(httpServer);

            this.server.on('connection', (socket: SocketIO.Socket) => {
                // store user
                console.log('user ' + socket.id + ' has connected');
                var wc = new WebClient(socket);
                this.users[socket.id] = wc;

                socket.on('disconnect', (s: SocketIO.Socket) => {
                    delete this.users[socket.id];
                    console.log('user ' + socket.id + ' disconnected');
                });

                socket.on('subscribe', (msg: ClientSubscription) => {
                    console.log('subscribe ' + JSON.stringify(msg.target));
                    wc.Subscribe(msg);
                    // wc.Client.emit('laag', 'test');
                    //socket.emit('laag', 'test');
                });

                // create layers room
                //var l = socket.join('layers');
                //l.on('join',(j) => {
                //    console.log("layers: "+ j);
                //});
            });
        }

        public registerLayer(id: string) {

        }

        public updateSensorValue(sensor: string, date: number, value: number) {
            //console.log('updateSensorValue:' + sensor);
            for (var uId in this.users) {
                //var sub = this.users[uId].FindSubscription(sensor,"sensor");
                for (var s in this.users[uId].Subscriptions) {
                    var sub = this.users[uId].Subscriptions[s];
                    if (sub.type == "sensor" && sub.target == sensor) {
                        //console.log('sending update:' + sub.id);
                        var cm = new ClientMessage("sensor-update", [{ sensor: sensor, date: date, value: value }]);
                        //console.log(JSON.stringify(cm));
                        this.users[uId].Client.emit(sub.id, cm);
                    }
                }
            }
        }

        public updateFeature(layer: string, feature: csComp.Services.IFeature) {
            //console.log('update feature ' + layer);
            for (var uId in this.users) {
                var sub = this.users[uId].FindSubscription(layer, "layer");
                if (sub != null) {
                    //console.log('sending update:' + sub.id);
                    this.users[uId].Client.emit(sub.id, new ClientMessage("feature-update", [feature]));
                }
            }
        }

        public deleteFeature(layer: string, feature: csComp.Services.IFeature) {
            for (var uId in this.users) {
                var sub = this.users[uId].FindSubscription(layer, "layer");
                if (sub != null) {
                    this.users[uId].Client.emit(sub.id, new ClientMessage("feature-delete", [feature.id]));
                }
            }
        }
    }
}
export = ClientConnection;

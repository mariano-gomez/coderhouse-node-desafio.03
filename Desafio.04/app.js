const express = require('express');
const http = require('http');
const path = require('path');
const handlebars = require('express-handlebars');
const { Server, Socket} = require('socket.io');

const SocketManager = require('./managers/SocketManager');
const socketManagerFunction = require('./websockets');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

//  setting the `handlebars` template engine
app.engine('handlebars', handlebars.engine());
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'handlebars');

//  Some global configs
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname + '/public')));

//  setting the routes
const { apiRoutes, standardRoutes } = require('./routes');
app.use('/api', apiRoutes);

//  To send an error response for any URL not supported
app.use('/', standardRoutes);

//  enabling websockets activity
io.on(
    'connection', (socket) => {//  event name we're going to listen
        //  I need to somehow have a way to keep a reference from everywhere to the SocketManager, a singleton is the
        //  only way i could come up with
        SocketManager.getInstance(socket);
        socketManagerFunction(socket);
    }
);

const port = 8080;

server.listen(port, () => {
    console.log(`Express Server listening at http://localhost:${port}`);
});

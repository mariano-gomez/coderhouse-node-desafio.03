const _dotenv = require('../config/config');

class FactoryDao {

    static getInstance(model) {
        let persistanceFile;

        switch (model) {
            case 'chat.message':
                persistanceFile = ((_dotenv.PERSISTENCE == 'mongo') ? './db/' : './filesystem/') + model + '.manager';
                break;
            case 'product':
            case 'cart':
            case 'user':
                persistanceFile = './db/' + model + '.manager';
        }
        const manager = require(persistanceFile);
        return manager;
    }
}

module.exports = FactoryDao;
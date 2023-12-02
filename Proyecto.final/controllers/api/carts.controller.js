const factory = require("../../dao/factory.dao");
const cartManager = factory.getInstance('cart');
const productManager = factory.getInstance('product');
const ticketService = require('../../services/ticket.service');
const CustomError = require("../../utils/custom.error.utils");
const StripeService = require("../../services/stripe.service");
const dependencyContainer = require("../../dependency.injection");
const logger = dependencyContainer.get('logger');

class CartsApiController {

    //  /api/carts [create a new cart]
    static createNewCart = async (req, res, next) => {
        try {
            //  req.user is set in a global middleware, until we start managing users/sessions/authentication/etc
            const newCart = await cartManager.create(req.user.id);
            res.status(201).send(newCart);
        } catch (e) {
            return next(e);
        }
    };

    //  /api/carts/:cid [get a specific cart content]
    static showCart = async (req, res) => {
        const { cid } = req.params;

        const cart = await cartManager.getById(cid);
        if (cart) {
            res.send(cart.products);
        } else {
            res.sendStatus(404);
        }
    };

    //  /api/carts/:cid [get a specific cart content]
    static showCartAvailability = async (req, res) => {
        const { cid } = req.params;

        const cart = await cartManager.getById(cid);
        if (cart) {
            res.send(await CartsApiController.checkCartContentAvailability(cart));
        } else {
            res.sendStatus(404);
        }
    };

    //  /api/carts/:cid/product/:pid    [increments a product quantity/add one unit to the cart if it does not exist]
    static incrementProductQuantity = async (req, res, next) => {
        const { cid, pid } = req.params;
        try {
            const cartUpdated = await cartManager.addProduct(cid, pid);
            if (cartUpdated === null) {
                res.sendStatus(404);
                return;
            }
            res.status(200).send(cartUpdated.products);
        } catch (e) {
            return next(e);
        }
    };

    //  api/carts/:cid/products/:pid [removes a specific product from a specific cart]
    static removeProductFromCart = async (req, res, next) => {
        const { cid, pid } = req.params;
        try {
            const result = await cartManager.deleteProduct(cid, pid);
            if (result.modifiedCount > 0) {
                res.sendStatus(204);
            } else {
                throw new CustomError("The cart couldn't be modified. Check if the cart id and the product id are both correct", CustomError.ERROR_TYPES.DATABASE_ERROR, 404);
            }
        } catch (e) {
            return next(e);
        }
    };

    //  api/carts/:cid  [it removes all products from the cart]
    static emptyCart = async (req, res, next) => {
        const { cid } = req.params;
        try {
            const cartUpdated = await cartManager.clearCart(cid);
            if (cartUpdated) {
                res.sendStatus(204);
            } else {
                throw new CustomError(`The cart couldn't be modified. Check if the cart id is correct`, CustomError.ERROR_TYPES.INPUT_ERROR, 404);
            }
        } catch (e) {
            return next(e);
        }
    };

    //  api/carts/:cid/products/:pid [set the quantity for a specific cart and product]
    static changeProductQuantityOnCart = async (req, res, next) => {
        const { cid, pid } = req.params;
        const quantity = parseInt(req.body.toString());

        try {
            if (isNaN(quantity)) {
                throw new CustomError('the data sent in the request must be an integer', CustomError.ERROR_TYPES.INPUT_ERROR, 400);
            }
            if (quantity < 1) {
                throw new CustomError('the value sent must be a positive integer', CustomError.ERROR_TYPES.INPUT_ERROR, 400);
            }
            const cartUpdated = await cartManager.setProductQuantity(cid, pid, quantity);
            if (cartUpdated === null) {
                res.sendStatus(404);
                return;
            }
            res.status(200).send(cartUpdated.products);
        } catch (e) {
            return next(e);
        }
    };

    //  It replaces all the products in the given cart, for the ones specified on the request
    static changeCartContent = async (req, res, next) => {
        const { cid } = req.params;
        const { products } = req.body;

        try {
            const cartUpdated = await cartManager.updateCartWithProducts(cid, products);
            res.send(cartUpdated.products);
        } catch (e) {
            return next(e);
        }
    };

    static purchase = async (req, res, next) => {
        const { cid } = req.params;

        try {
            const cart = await cartManager.getById(cid);

            if (!cart) {
                throw new CustomError('cart not found', CustomError.ERROR_TYPES.INPUT_ERROR, 404);
            }

            if (!cart.products.length) {
                throw new CustomError('cart not found', CustomError.ERROR_TYPES.INPUT_ERROR, 406);
            }

            const purchaseResponse = await ticketService.finishPurchase(cart);

            if (purchaseResponse.ticket) {

                const sessionResponse = await StripeService.createCheckoutSession(purchaseResponse.ticket, cid);
                res.send({
                    'status': 'success',
                    'payload': sessionResponse.url
                });
            } else if (!purchaseResponse.unavailable?.length) {
                throw new CustomError('There is no stock for any of your products', CustomError.ERROR_TYPES.DATABASE_ERROR, 406);
            } else {
                throw new CustomError('something went wrong, please try again', CustomError.ERROR_TYPES.UNKNOWN_ERROR, 500);
            }

        } catch (e) {
            next(e);
        }
    }

    //  TODO: This method is very similar to ticketService.finishPurchase(), probably i'll hava to try to refactor the code at some point
    static async checkCartContentAvailability(cart) {
        const unavailableProducts = [];
        const availableProducts = [];

        try {
            for (let cartProduct of cart.products) {
                //  I get the product from the catalog
                const catalogProduct = await productManager.getById(cartProduct.product._id);
                if (cartProduct.quantity <= catalogProduct.stock) {

                    availableProducts.push({
                        id: cartProduct.product._id,
                        title: cartProduct.product.title,
                        in_cart: cartProduct.quantity,
                        in_stock: cartProduct.product.stock
                    });
                } else {
                    unavailableProducts.push({
                        id: cartProduct.product._id,
                        title: cartProduct.product.title,
                        in_cart: cartProduct.quantity,
                        in_stock: cartProduct.product.stock
                    });
                }
            }

            return {
                available: availableProducts,
                unavailable: unavailableProducts,
            };
        } catch (e) {
            logger.error(e.message);
            logger.error('partial creation of ticket, for cart ', cart._id.toString());
            return null;
        }
    }
}

module.exports = CartsApiController;
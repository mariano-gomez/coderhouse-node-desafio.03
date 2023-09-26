const factoryDAO = require('../dao/factory.dao');
const cartManager = factoryDAO.getInstance('cart');
const productManager = factoryDAO.getInstance('product');
const userManager = factoryDAO.getInstance('user');
const ticketManager = factoryDAO.getInstance('ticket');

const finishPurchase = async (cart) => {
    const user = await userManager.getById(cart.user._id);

    const ticketData = {
        user: user._id,
        code: await generateTicketCode(),
        amount: 0,
        products: [],
        purchaser: user.email
    };

    const unavailableProducts = [];

    try {
        for (let cartProduct of cart.products) {
            if (cartProduct.quantity <= cartProduct.product.stock) {

                //  I get the product from the catalog
                const catalogProduct = await productManager.getById(cartProduct.product._id);

                //  I update the stock for such product
                await productManager.update(cartProduct.product._id, { stock: catalogProduct.stock - cartProduct.quantity });

                //  Then, I remove the product from the car
                await cartManager.deleteProduct(cart._id, cartProduct.product._id);
                ticketData.products.push({
                    id: cartProduct.product._id,
                    title: cartProduct.product.title,
                    quantity: cartProduct.quantity,
                    unit_price: catalogProduct.price,
                    subtotal: (catalogProduct.price * cartProduct.quantity).toFixed(2) * 1  //  because `toFixed()` transforms it into string
                });
                ticketData.amount = (ticketData.amount + catalogProduct.price * cartProduct.quantity).toFixed(2) * 1;  //  because `toFixed()` transforms it into string
            } else {
                unavailableProducts.push({
                    id: cartProduct.product._id,
                    title: cartProduct.product.title,
                    in_cart: cartProduct.quantity,
                    in_stock: cartProduct.product.stock
                })
            }
        }

        const response = { ticket:null, unavailable: unavailableProducts };
        if (ticketData.products.length) {
            response.ticket = await ticketManager.create(ticketData);
        }
        return response;
    } catch (e) {
        console.log(e.message);
        console.log('partial creation of ticket, for cart ', cart._id.toString());
        return null;
    }
}

const generateTicketCode = async () => {
    const lastTicket = await ticketManager.getLastTicket();
    if (!lastTicket) {
        return 0;
    }
    return lastTicket.code + 1;
}

module.exports = {
    finishPurchase
};
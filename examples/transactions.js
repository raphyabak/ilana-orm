const { DB, Model } = require('../index');

// Example models
class User extends Model {
  static table = 'users';
  fillable = ['name', 'email'];
  
  static {
    this.register();
  }
}

class Order extends Model {
  static table = 'orders';
  fillable = ['user_id', 'total', 'status'];
  
  items() {
    return this.hasMany('OrderItem', 'order_id');
  }
  
  static {
    this.register();
  }
}

class OrderItem extends Model {
  static table = 'order_items';
  fillable = ['order_id', 'product_id', 'quantity', 'price'];
  
  static {
    this.register();
  }
}

class Payment extends Model {
  static table = 'payments';
  fillable = ['order_id', 'amount', 'method'];
  
  static {
    this.register();
  }
}

// Laravel-style transaction examples
async function exampleTransactions() {
  
  // Example 1: Simple transaction with callback
  await DB.transaction(async () => {
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com'
    });
    
    const order = await Order.create({
      user_id: user.id,
      total: 99.99,
      status: 'pending'
    });
    
    await Payment.create({
      order_id: order.id,
      amount: 99.99,
      method: 'credit_card'
    });
  });

  // Example 2: Transaction with retry attempts for deadlocks
  await DB.transaction(async () => {
    const order = await Order.create({
      user_id: 1,
      total: 149.99,
      status: 'pending'
    });
    
    // Create multiple order items
    const items = [
      { product_id: 1, quantity: 2, price: 49.99 },
      { product_id: 2, quantity: 1, price: 49.99 }
    ];
    
    for (const item of items) {
      await OrderItem.create({
        order_id: order.id,
        ...item
      });
    }
    
    await Payment.create({
      order_id: order.id,
      amount: 149.99,
      method: 'paypal'
    });
  }, 3); // Retry up to 3 times for deadlocks

  // Example 3: Manual transaction control
  const trx = await DB.beginTransaction();
  
  try {
    const user = await User.create({
      name: 'Jane Smith',
      email: 'jane@example.com'
    });
    
    const order = await Order.create({
      user_id: user.id,
      total: 199.99,
      status: 'pending'
    });
    
    // Simulate some condition that might fail
    if (order.total > 150) {
      throw new Error('Order total too high');
    }
    
    await DB.commit(trx);
  } catch (error) {
    await DB.rollback(trx);
    console.error('Transaction failed:', error.message);
    throw error;
  }

  // Example 4: Transaction with closure variables
  const orderData = { user_id: 1, total: 299.99, status: 'pending' };
  const paymentData = { amount: 299.99, method: 'bank_transfer' };
  
  await DB.transaction(async () => {
    const order = await Order.create(orderData);
    const payment = await Payment.create({
      order_id: order.id,
      ...paymentData
    });
    
    // All model operations within this callback automatically
    // use the same transaction
    console.log('Order and payment created successfully');
  });
}

module.exports = {
  User,
  Order,
  OrderItem,
  Payment,
  exampleTransactions
};
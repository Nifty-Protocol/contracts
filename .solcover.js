module.exports = {
    client: require('ganache-cli'),
    providerOptions: {
        host: "localhost",
        port: 8545,
        network_id: "*"
    }
};
Before doing anything, you need to install all the required Node packages. Run the following command in your terminal:

`npm install`

2. Environment Configuration
Next, set up your local environment variables. Copy the provided example file:

`cp .env.example .env`

Open your new .env file and update your database credentials:

'DB_PASSWORD=YOUR_PASSWORD_HERE
DB_NAME=ifamous_dbms'


Run the Server
Once your dependencies are installed and your database is linked, start the backend server:

`node .\server.js\ `

to run the server
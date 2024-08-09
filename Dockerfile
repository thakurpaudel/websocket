
FROM node:20

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) first
# This is to leverage Docker's caching mechanism and avoid reinstalling dependencies unless these files change
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose the port that your application will run on
# For example, if your application listens on port 3000
EXPOSE 3000

# Define the command to run your application
# Replace 'app.js' with the entry point of your application
CMD ["node", "src/server.js"]

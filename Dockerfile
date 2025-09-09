# Use an official Node.js runtime as a parent image.
# Using a specific version with Alpine for a lightweight and secure image.
FROM node:20-alpine

# Set the working directory inside the container.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory.
# This step is critical for efficient caching. If package.json doesn't change,
# Docker reuses this layer and skips the npm install step.
COPY package*.json ./

# Install application dependencies.
# We install all dependencies, including devDependencies like nodemon,
# so they are available in the container.
RUN npm install

# Copy the rest of the application's source code to the container.
COPY . .

# Expose the port the app runs on.
EXPOSE 3000

# Define the command to run your app.
# The `npm run dev` script will be used during development.
CMD [ "npm", "run", "dev" ]

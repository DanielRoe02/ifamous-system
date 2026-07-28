1. Dependencies Setup

Before doing anything, you need to install all the required Node packages. Run the following command in your terminal:

`npm install`

2. Environment Configuration

Next, set up your local environment variables. Copy the provided example file:

`cp .env.example .env`

Open your new .env file and update your database credentials:

```
DB_PASSWORD=YOUR_PASSWORD_HERE
DB_NAME=ifamous_dbms
```

3. Python Setup (Docling Table OCR)

The AI assistant uses **IBM Docling Table OCR** to accurately extract 2D grid matrix timetables. To enable Docling OCR, set up a Python virtual environment in the `server/` directory:

1. Ensure Python 3.9+ is installed (`python --version`).
2. Open terminal in the `server/` directory.
3. Create a Python virtual environment:
   - **Windows**: `python -m venv venv`
   - **Linux / macOS**: `python3 -m venv venv`
4. Install Python dependencies:
   - **Windows**: `.\venv\Scripts\python.exe -m pip install -r requirements.txt`
   - **Linux / macOS**: `./venv/bin/python -m pip install -r requirements.txt`

*(Note: If Python or Docling is not configured, the server automatically falls back to Tesseract.js OCR).*

4. Run the Server

Once your dependencies are installed, Python environment is ready, and your database is linked, start the backend server:

`node .\server.js`
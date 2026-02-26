# 🏮 WenYanTrans - Classical Chinese Analysis Tool

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8%2B-blue" alt="Python 3.8+">
  <img src="https://img.shields.io/badge/Flask-2.3.0%2B-lightgrey" alt="Flask 2.3.0+">
  <img src="https://img.shields.io/badge/OpenRouter-API-orange" alt="OpenRouter API">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

> An AI-powered web application for analyzing and understanding Classical Chinese texts using modern deep learning models.

**WenYanTrans** is an educational web tool that helps learners decipher Classical Chinese texts through a structured, step-by-step analysis process. Powered by the Kimi model via OpenRouter API, it acts as a "Classical Chinese Detective Mentor" guiding users through the intricate process of understanding ancient texts.

## ✨ Features

### 🔍 **Intelligent Text Analysis**
- **Five-Step Analysis Method**: Systematic approach to deciphering Classical Chinese
- **AI-Powered Explanations**: Uses Moonshot AI's Kimi model for contextual understanding
- **Batch Processing**: Supports analysis of long texts with intelligent segmentation
- **Real-time Progress**: Live progress tracking with concurrent processing (up to 8 segments)

### 📚 **Educational Focus**
- **Contextual Learning**: Explains grammar, vocabulary, and sentence structure
- **Interactive Guidance**: Step-by-step breakdown of complex passages
- **Modern Translations**: Provides accurate contemporary Chinese translations
- **Learning Methodology**: Implements "Exam Practice Method" teaching strategy

### 💻 **User-Friendly Interface**
- **Drag & Drop Support**: Import text files (.txt) directly
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Markdown Export**: Copy analysis results in markdown format
- **Preview Mode**: Edit and review segments before analysis

### 🔧 **Technical Features**
- **Concurrent Processing**: Efficient handling of multiple text segments
- **Error Recovery**: Automatic retry mechanism (up to 3 attempts)
- **Health Monitoring**: Real-time backend connection status
- **API Abstraction**: Secure API key management on backend

## 🏗️ Technology Stack

### **Backend**
- **Python 3.8+** - Core programming language
- **Flask 2.3.0+** - Lightweight web framework
- **Flask-CORS 4.0.0+** - Cross-origin resource sharing
- **Requests 2.31.0+** - HTTP client library

### **Frontend**
- **HTML5** - Semantic markup
- **CSS3** - Responsive styling with CSS variables
- **Vanilla JavaScript** - Interactive functionality (no frameworks)
- **Google Fonts** - Chinese typefaces (Noto Sans SC, Noto Serif SC, Ma Shan Zheng)

### **AI/ML Services**
- **OpenRouter API** - Unified AI model gateway
- **Kimi Model** - `moonshotai/kimi-k2-thinking` (DeepSeek's Kimi)

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- OpenRouter API key (free tier available)
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/WenYanTrans.git
   cd WenYanTrans
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure API key**
   ```bash
   # Set environment variable for OpenRouter API key
   # Get a free API key from https://openrouter.ai
   # On Windows (Command Prompt):
   set wenyantrans_openrouter_apikey=your-api-key-here
   # On Windows (PowerShell):
   $env:wenyantrans_openrouter_apikey="your-api-key-here"
   # On macOS/Linux:
   export wenyantrans_openrouter_apikey=your-api-key-here
   ```
   Note: The API key is now read from the environment variable `wenyantrans_openrouter_apikey` and should not be stored in config.json.

   ```json
   {
     "model_name": "deepseek/deepseek-v3.2",
     "api_endpoint": "https://openrouter.ai/api/v1/chat/completions",
     "custom_param": {
       "provider": {
         "order": ["atlas-cloud/fp8", "novita/fp8", "deepinfra/fp4"],
         "allow_fallbacks": true
       },
       "reasoning": {
         "enabled": true
       }
     }
   }
   ```

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:1201`

## 📖 Usage Guide

### Basic Usage
1. **Input Text**: Paste Classical Chinese text directly into the text area
2. **File Upload**: Drag and drop a `.txt` file or click to browse
3. **Start Analysis**: Click the "Start Analysis" button
4. **View Results**: Watch real-time progress and view detailed analysis

### Analysis Process
The tool follows a structured five-step analysis method:

1. **Anchor Known & Core Event Locking**
   - Identify recognized vocabulary
   - Extract main narrative skeleton
   - Lock core events

2. **Contextual Logic Chain Guessing**
   - Focus on truly difficult words
   - Show complete reasoning chains
   - Use auxiliary tools (radical tracing, loanword speculation, parallel text training)

3. **Tool Application**
   - Provide concise dictionary definitions for moderately difficult words

4. **Grammar Focus**
   - Analyze function words and special sentence patterns
   - Explain grammatical functions and translation methods

5. **Comprehensive Translation**
   - Output precise modern Chinese translation

### Advanced Features
- **Preview Mode**: Review and edit text segments before analysis
- **Concurrent Processing**: Automatic segmentation for long texts
- **Markdown Export**: Copy formatted results for notes or documentation

## ⚙️ Configuration

### Environment Setup
Create a `config.json` file in the project root:

```json
{
  "model_name": "deepseek/deepseek-v3.2",
  "api_endpoint": "https://openrouter.ai/api/v1/chat/completions",
  "custom_param": {
    "provider": {
      "order": ["atlas-cloud/fp8", "novita/fp8", "deepinfra/fp4"],
      "allow_fallbacks": true
    },
    "reasoning": {
      "enabled": true
    }
  }
}
```

### Custom Parameter Support
The `custom_param` field allows you to add any custom parameters to the API request payload. This replaces the previous separate `provider` and `reasoning` fields. You can include any valid OpenRouter API parameters in the `custom_param` object, such as:
- `temperature`, `max_tokens`, `top_p`, etc.
- `provider` configuration for fallback routing
- `reasoning` settings for thinking models
- Any other parameters supported by the OpenRouter API

The contents of `custom_param` will be merged directly into the API request payload (excluding `model` and `messages` which are already set by the application).

**Note**: All custom parameters must now be placed within the `custom_param` object. The previous separate `provider` and `reasoning` fields are no longer supported.

#### Example: Adding custom parameters
```json
{
  "model_name": "moonshotai/kimi-k2-thinking",
  "api_endpoint": "https://openrouter.ai/api/v1/chat/completions",
  "custom_param": {
    "provider": {
      "order": ["chutes/int4", "deepinfra/fp4"],
      "allow_fallbacks": true
    },
    "reasoning": {
      "enabled": true
    },
    "temperature": 0.7,
    "max_tokens": 4000,
    "top_p": 0.9,
    "stream": false,
    "stop": ["\n\n", "###"]
  }
}
```

In this example, all parameters inside `custom_param` will be included in the API request to OpenRouter.

### Customization Options
- **Port**: Modify `app.py` line 176 to change server port (default: 1201)
- **Model**: Change `model_name` in `config.json` to use different AI models
- **Concurrency**: Adjust `MAX_CONCURRENT_CALLS` in `static/js/main.js` line 4
- **Retry Attempts**: Modify `MAX_RETRY_ATTEMPTS` in `static/js/main.js` line 5

## 📁 Project Structure

```
WenYanTrans/
├── app.py                    # Flask application (main backend logic)
├── config.json              # API configuration (OpenRouter credentials)
├── requirements.txt         # Python dependencies
├── README.md               # This file
├── favicon.ico             # Website favicon
├── port@1201               # Port indicator file
├── __pycache__/            # Python bytecode cache
├── templates/              # HTML templates
│   └── index.html          # Main page template
└── static/                 # Static assets
    ├── favicon.ico         # Favicon (copy)
    ├── css/
    │   └── style.css       # Stylesheet (dark/light theme support)
    └── js/
        └── main.js         # Frontend JavaScript logic
```

### Key Files
- **`app.py`**: Contains Flask routes, API integration, and system prompt
- **`static/js/main.js`**: Frontend logic including file handling, API calls, and progress management
- **`static/css/style.css`**: Responsive design with dark/light theme support
- **`templates/index.html`**: Single-page application interface

## 🎯 Educational Philosophy

WenYanTrans implements a unique educational approach:

### **Detective Mentor Methodology**
The AI acts as a patient "Classical Chinese Detective Mentor" using the "Exam Practice Method" to teach beginners how to decipher Classical Chinese long sentences.

### **Core Principles**
- **70/30 Focus**: 70% effort on understanding sentence logic, 30% on攻克真正的难点
- **Precision over Coverage**: Targeted analysis of difficult words rather than blanket explanations
- **Visible Learning Path**: Shows users "how to go from understanding words to understanding sentences"

### **Teaching Strategy**
- **Step-by-Step Guidance**: Structured five-step process
- **Contextual Learning**: Emphasis on sentence structure and logical relationships
- **Practical Application**: Focus on skills applicable to actual Classical Chinese comprehension

## 🔧 Development

### Running in Development Mode
```bash
python app.py
```
The server starts with debug mode enabled on `http://localhost:1201`

### Dependencies Management
```bash
# Generate requirements.txt
pip freeze > requirements.txt

# Install from requirements.txt
pip install -r requirements.txt
```

### Code Style
- **Backend**: Follows PEP 8 guidelines
- **Frontend**: Modular JavaScript with clear separation of concerns
- **Comments**: Chinese comments for educational context, English for technical documentation

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Bugs**: Open an issue with detailed reproduction steps
2. **Suggest Features**: Propose new features or improvements
3. **Submit Pull Requests**: Fork the repository and submit a PR

### Development Guidelines
- Maintain educational focus and clarity
- Ensure backward compatibility
- Add tests for new features
- Update documentation accordingly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenRouter** for providing unified AI model access
- **Moonshot AI** for the excellent Kimi model
- **Google Fonts** for Chinese typography resources
- **Flask** community for the lightweight web framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/WenYanTrans/issues)
- **Documentation**: This README and inline code comments
- **Examples**: Try analyzing sample Classical Chinese texts from the repository

---

<p align="center">
  Made with ❤️ for Classical Chinese learners everywhere
</p>

<p align="center">
  <sub>If you find this tool helpful, consider giving it a ⭐ on GitHub!</sub>
</p>
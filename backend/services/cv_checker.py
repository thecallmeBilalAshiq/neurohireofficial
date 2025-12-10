#!/usr/bin/env python3
"""
CV Format Checker
This script checks if an uploaded CV matches the required format template.
Uses basic PDF text extraction (PyMuPDF) for text extraction.
"""

import sys
import json
import os
from pathlib import Path

try:
    from docx import Document
    import fitz  # PyMuPDF for PDF processing
except ImportError as e:
    print(json.dumps({
        "isValid": False,
        "message": f"Missing required library: {str(e)}. Please install: pip install python-docx PyMuPDF"
    }), file=sys.stderr)
    sys.exit(1)

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file using PyMuPDF."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def extract_text_from_docx(docx_path):
    """Extract text from DOCX file."""
    try:
        doc = Document(docx_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text
    except Exception as e:
        raise Exception(f"Failed to extract text from DOCX: {str(e)}")

def check_cv_format(cv_path, template_path):
    """Check if CV matches the template format."""
    try:
        # Extract text from CV using basic PDF extraction
        cv_text = extract_text_from_pdf(cv_path)
        
        if not cv_text or len(cv_text.strip()) < 10:
            return {
                "isValid": False,
                "message": "CV file appears to be empty or could not be read. Please ensure the PDF contains text."
            }
        
        if not os.path.exists(template_path):
            # If template doesn't exist, just validate that CV has required fields
            has_required = validate_cv_structure(cv_text)
            if has_required:
                extracted_data = extract_basic_info(cv_text)
                return {
                    "isValid": True,
                    "extractedData": extracted_data,
                    "message": "CV format is valid"
                }
            else:
                return {
                    "isValid": False,
                    "message": "CV is missing required sections. Please use the provided template."
                }
        
        template_text = extract_text_from_docx(template_path)
        
        # Validate CV structure
        has_required = validate_cv_structure(cv_text)
        
        if has_required:
            # Extract structured data
            extracted_data = extract_basic_info(cv_text)
            
            return {
                "isValid": True,
                "extractedData": extracted_data,
                "message": "CV format is valid"
            }
        else:
            return {
                "isValid": False,
                "message": "CV is missing required sections. Please use the provided template."
            }
                
    except Exception as e:
        return {
            "isValid": False,
            "message": f"Error processing CV: {str(e)}"
        }

def validate_cv_structure(cv_text):
    """Validate that CV has required sections."""
    cv_lower = cv_text.lower()
    
    # Check for required fields
    has_name = any(keyword in cv_lower for keyword in ['name', 'full name', 'candidate'])
    has_email = '@' in cv_text or 'email' in cv_lower
    has_phone = any(keyword in cv_lower for keyword in ['phone', 'mobile', 'contact', 'tel'])
    has_education = any(keyword in cv_lower for keyword in ['education', 'qualification', 'degree', 'university'])
    has_experience = any(keyword in cv_lower for keyword in ['experience', 'work', 'employment', 'career'])
    
    return has_name and has_email and has_phone and has_education and has_experience

def extract_basic_info(cv_text):
    """Extract basic information from CV text using simple pattern matching."""
    import re
    
    data = {}
    
    # Extract email
    email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', cv_text)
    if email_match:
        data['email'] = email_match.group(0)
    
    # Extract phone
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', cv_text)
    if phone_match:
        data['phone'] = phone_match.group(0)
    
    # Extract name (first line or after "Name:" pattern)
    name_match = re.search(r'(?:name|full name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', cv_text, re.IGNORECASE)
    if name_match:
        data['name'] = name_match.group(1)
    else:
        # Try to get first line as name
        first_line = cv_text.split('\n')[0].strip()
        if len(first_line) > 0 and len(first_line) < 50:
            data['name'] = first_line
    
    # Extract education section
    education_match = re.search(r'(?:education|qualification)[:\s]+(.*?)(?:\n\n|\n(?:experience|work|skills))', cv_text, re.IGNORECASE | re.DOTALL)
    if education_match:
        data['education'] = education_match.group(1).strip()
    
    # Extract experience section
    experience_match = re.search(r'(?:experience|work history|employment)[:\s]+(.*?)(?:\n\n|\n(?:skills|projects|education))', cv_text, re.IGNORECASE | re.DOTALL)
    if experience_match:
        data['experience'] = experience_match.group(1).strip()
    
    # Extract skills
    skills_match = re.search(r'(?:skills|technical skills)[:\s]+(.*?)(?:\n\n|\n(?:languages|projects|education))', cv_text, re.IGNORECASE | re.DOTALL)
    if skills_match:
        data['skills'] = skills_match.group(1).strip()
    
    # Extract languages
    languages_match = re.search(r'(?:languages|language)[:\s]+(.*?)(?:\n\n|\n(?:projects|education|experience))', cv_text, re.IGNORECASE | re.DOTALL)
    if languages_match:
        data['languages'] = languages_match.group(1).strip()
    
    # Extract projects
    projects_match = re.search(r'(?:projects|project)[:\s]+(.*?)(?:\n\n|\n(?:education|experience|skills))', cv_text, re.IGNORECASE | re.DOTALL)
    if projects_match:
        data['projects'] = projects_match.group(1).strip()
    
    return data

def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "isValid": False,
            "message": "Usage: python cv_checker.py <cv_path> <template_path>"
        }))
        sys.exit(1)
    
    cv_path = sys.argv[1]
    template_path = sys.argv[2]
    
    if not os.path.exists(cv_path):
        print(json.dumps({
            "isValid": False,
            "message": f"CV file not found: {cv_path}"
        }))
        sys.exit(1)
    
    result = check_cv_format(cv_path, template_path)
    print(json.dumps(result))

if __name__ == "__main__":
    main()

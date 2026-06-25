#!/usr/bin/env python3
"""
Comprehensive auto-fix script for broken TypeScript/React code.
This script intelligently fixes common patterns introduced by aggressive space removal.
"""

import re
import os
from pathlib import Path

def fix_content(content):
    """Apply comprehensive fixes to code content."""
    
    # Phase 0: Fix specific problematic patterns FIRST (before keyword fixing)
    # These must be fixed before general keyword rules to avoid false positives
    specific_fixes = {
        r'\bfor\s+matAddress\b': 'formatAddress',
        r'\bfor\s+mat\b': 'format',
        r'\bfor\s+Each\b': 'forEach',
        r'\binter\s+face\b': 'interface',
    }
    
    for pattern, replacement in specific_fixes.items():
        content = re.sub(pattern, replacement, content)
    
    # Phase 1: Fix keyword spacing
    keywords = ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'while', 
                'try', 'catch', 'finally', 'throw', 'new', 'import', 'export', 'await', 'async',
                'switch', 'case', 'break', 'continue', 'class', 'interface', 'type', 'enum']
    
    # Note: 'for' is intentionally excluded here to avoid false positives with 'format'
    
    for keyword in keywords:
        # Fix keyword followed by lowercase letter without space
        content = re.sub(rf'\b{keyword}([a-z])', rf'{keyword} \1', content)
        # Fix keyword followed by uppercase letter without space (for function, class, etc.)
        if keyword in ['function', 'new', 'import', 'export', 'class', 'extends', 'implements']:
            content = re.sub(rf'\b{keyword}([A-Z])', rf'{keyword} \1', content)
    
    # Phase 2: Fix common merged identifiers
    merged_patterns = {
        # React hooks
        r'\buseStat\s*e\b': 'useState',
        r'\buseEf\s*fect\b': 'useEffect',
        r'\buseRe\s*f\b': 'useRef',
        r'\buseCall\s*back\b': 'useCallback',
        r'\buseMemo\b': 'useMemo',
        
        # Wagmi hooks
        r'\buseWriteCon\s*tract\b': 'useWriteContract',
        r'\buseWaitFor\s*Transaction\s*Receipt\b': 'useWaitForTransactionReceipt',
        r'\buseReadCon\s*tract\b': 'useReadContract',
        r'\buseAccount\b': 'useAccount',
        
        # Common state variables
        r'\bisCon\s*necting\b': 'isConnecting',
        r'\bisD\s*isconnecting\b': 'isDisconnecting',
        r'\bisCon\s*firming\b': 'isConfirming',
        r'\bisCon\s*firmed\b': 'isConfirmed',
        r'\bisLoadin\s*g\b': 'isLoading',
        r'\bisWritePending\b': 'isWritePending',
        r'\bsetIsSwitchin\s*g\b': 'setIsSwitching',
        r'\bsetIsLoadin\s*g\b': 'setIsLoading',
        
        # Common words
        r'\bcon\s*tract\b': 'contract',
        r'\bcon\s*tracts\b': 'contracts',
        r'\bh\s*and\s*le\b': 'handle',
        r'\bfor\s*mat\b': 'format',
        r'\bnavigat\s*or\b': 'navigator',
        r'\bw\s*all\s*et\b': 'wallet',
        r'\brespon\s*se\b': 'response',
        r'\bhisto\s*ry\b': 'history',
        
        # JSX attributes
        r'\bclassName\b': 'className',
        r'\bonClick\b': 'onClick',
        r'\bonChange\b': 'onChange',
        r'\bstopPropagat\s*ion\b': 'stopPropagation',
        r'\bpreventDefault\b': 'preventDefault',
        
        # Wallet specific
        r'wall\s*et_': 'wallet_',
        r'\bnat\s*iveCurrency\b': 'nativeCurrency',
    }
    
    for pattern, replacement in merged_patterns.items():
        content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
    
    # Phase 3: Fix JSX tag spacing (critical!)
    jsx_tags = ['div', 'span', 'button', 'svg', 'nav', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                'a', 'input', 'textarea', 'form', 'label', 'select', 'option', 'ul', 'ol', 'li',
                'table', 'tr', 'td', 'th', 'thead', 'tbody']
    
    for tag in jsx_tags:
        # Fix merged className (e.g., "divclas" -> "div class")
        content = re.sub(rf'<{tag}clas\s+s', rf'<{tag} class', content)
        content = re.sub(rf'<{tag}clas\s*sName', rf'<{tag} className', content)
        # Also fix just "clas" without space
        content = re.sub(rf'<{tag}\s+clas\s+sName=', rf'<{tag} className=', content)
    
    # Phase 4: Fix string literals and common phrases
    string_fixes = {
        'addresscopiedsuccessfully': 'address copied successfully',
        'Cannotswitchnetwork': 'Cannot switch network',
        'Cannotgetwalletprovider': 'Cannot get wallet provider',
        'doesnotex\s*ist': 'does not exist',
        'Networkswitchsuccessful': 'Network switch successful',
        'Networkdoesnotexist': 'Network does not exist',
        'attemptingtoadd': 'attempting to add',
        'attemptingto': 'attempting to',
    }
    
    for broken, fixed in string_fixes.items():
        content = re.sub(broken, fixed, content, flags=re.IGNORECASE)
    
    # Phase 5: Fix comment + code merges
    # Fix "// Commentawait" -> "// Comment\nawait"
    content = re.sub(r'(//.+?)await\s+', r'\1\nawait ', content)
    content = re.sub(r'(//.+?)const\s+', r'\1\nconst ', content)
    content = re.sub(r'(//.+?)function\s+', r'\1\nfunction ', content)
    
    # Phase 6: Fix merged lines (e.g., "return addrreturn")
    content = re.sub(r'return\s+addr\s*return', r'return addr\n  return', content)
    
    # Phase 7: Fix spacing before braces
    content = re.sub(r'\)\s*\{', r') {', content)
    content = re.sub(r'else\s*\{', r'else {', content)
    content = re.sub(r'try\s*\{', r'try {', content)
    content = re.sub(r'catch\s*\{', r'catch {', content)
    content = re.sub(r'finally\s*\{', r'finally {', content)
    
    # Phase 8: Fix "as any" and type casts
    content = re.sub(r'connectorasany', r'connector as any', content)
    content = re.sub(r'(\w+)asany\b', r'\1 as any', content)
    
    # Phase 9: Fix chain-related identifiers
    content = re.sub(r'\bcurrentChain\s*Id\b', 'currentChainId', content)
    content = re.sub(r'\btargetChain\s*Id', 'targetChainId', content)
    content = re.sub(r'\bchainId', 'chainId', content)
    
    return content

def fix_file(filepath):
    """Fix a single file with comprehensive fixes."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        fixed = fix_content(content)
        
        if fixed != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed)
            return True
        return False
    except Exception as e:
        print(f"❌ Error fixing {filepath}: {e}")
        return False

def main():
    print("🔧 Starting comprehensive auto-fix...")
    print("=" * 60)
    
    frontend_dir = Path('frontend/src')
    extensions = ['.ts', '.tsx', '.js', '.jsx']
    
    iteration = 1
    max_iterations = 5
    
    while iteration <= max_iterations:
        print(f"\n📍 Iteration {iteration}/{max_iterations}")
        print("-" * 60)
        
        fixed_count = 0
        total_files = 0
        
        for ext in extensions:
            for filepath in frontend_dir.rglob(f'*{ext}'):
                total_files += 1
                if fix_file(filepath):
                    print(f"✅ Fixed: {filepath}")
                    fixed_count += 1
        
        print(f"\n📊 Iteration {iteration} complete:")
        print(f"   - Fixed {fixed_count} files")
        print(f"   - Total files scanned: {total_files}")
        
        if fixed_count == 0:
            print("\n✨ No more changes needed!")
            break
        
        iteration += 1
    
    print("\n" + "=" * 60)
    print("🎉 Comprehensive auto-fix complete!")
    print("\n💡 Next step: Run 'npm run build' to check for remaining errors")

if __name__ == '__main__':
    main()

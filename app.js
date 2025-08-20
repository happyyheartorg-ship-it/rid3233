// Supabase Configuration
const SUPABASE_URL = 'https://khexmdwjkiueylysbnfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZXhtZHdqa2l1ZXlseXNibmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0Nzc4NTksImV4cCI6MjA3MDA1Mzg1OX0.1CGzE3dwdimXxGGAEWID1uaWe9Hf3ixHwqv1z-3-hWk';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility function to load external scripts
function loadScript(src) {
    return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ---- Supabase API helpers ----
async function savePledge(pledge) {
    const { data, error } = await supabase.from('pledges').insert([pledge]).select();
    if (error) throw error;
    return data?.[0] ?? null;
}

async function getPledges({ limit = 50, offset = 0, orderBy = 'created_at', ascending = false } = {}) {
    let query = supabase.from('pledges').select('*');
    if (orderBy) query = query.order(orderBy, { ascending });
    if (limit != null) query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

async function getPledgeCount() {
    const { count, error } = await supabase.from('pledges').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
}

async function getPledgeByPhone(phoneNumber) {
    const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .eq('contact_number', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
}

// High-quality certificate PDF generation function
async function generateCertificatePDF(elementId, filename) {
    const certElem = document.getElementById(elementId);
    if (!certElem) {
        console.error('Certificate element not found:', elementId);
        alert('Certificate element not found. Please try again.');
        return;
    }
    
    try {
        // Show loading message
        const originalText = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        
        // Wait for fonts and images to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate high-quality canvas directly from the certificate element
        const canvas = await html2canvas(certElem, {
            scale: 2, // Good balance of quality and performance
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 10000,
            removeContainer: false,
            foreignObjectRendering: false,
            width: certElem.offsetWidth,
            height: certElem.offsetHeight,
            ignoreElements: (element) => {
                // Ignore any overlay elements that shouldn't be in PDF
                return element.classList && (
                    element.classList.contains('certificate-border') ||
                    element.classList.contains('modal-overlay') ||
                    element.classList.contains('download-btn')
                );
            }
        });

        // Create PDF with standard A4 dimensions (210mm x 297mm)
        let pdf;
        if (window.jspdf && window.jspdf.jsPDF) {
            pdf = new window.jspdf.jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
        } else if (typeof jsPDF !== 'undefined') {
            pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
        } else {
            throw new Error('jsPDF library not found');
        }
        
        // Get A4 dimensions in mm
        const pdfWidth = 210;
        const pdfHeight = 297;
        
        // Convert canvas to high-quality image
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Add image to PDF, fitting it to A4 size
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        
        // Save the PDF
        pdf.save(filename);
        
        // Restore cursor
        document.body.style.cursor = originalText;
        
        // Show success message
        console.log('Certificate PDF generated successfully');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        document.body.style.cursor = 'default';
        alert('There was an error generating the certificate PDF. Please check your internet connection and try again.');
    }
}

// Expose minimal API on window for optional external use (debug/tools)
window.supabaseApi = { savePledge, getPledges, getPledgeCount, getPledgeByPhone };

// Main application initialization
window.onload = function() {
    // DOM elements
    var modal = document.getElementById('pledge-modal');
    var openBtn = document.getElementById('open-pledge-modal');
    var closeBtn = document.getElementById('close-pledge-modal');
    var form = document.getElementById('pledge-form');
    var cert = document.getElementById('certificate-preview');
    var certName = document.getElementById('cert-name');
    var certDate = document.getElementById('cert-date');
    var downloadBtn = document.getElementById('download-certificate');
    var pledgeCountElem = document.getElementById('pledge-count');
    
    // Certificate retrieval modal elements
    var certModal = document.getElementById('certificate-modal');
    var openCertBtn = document.getElementById('open-certificate-modal');
    var closeCertBtn = document.getElementById('close-certificate-modal');
    var certLookupForm = document.getElementById('certificate-lookup-form');
    var certLookup = document.getElementById('certificate-lookup');
    var retrievedCert = document.getElementById('retrieved-certificate');
    var retrievedCertName = document.getElementById('retrieved-cert-name');
    var retrievedCertDate = document.getElementById('retrieved-cert-date');
    var downloadRetrievedBtn = document.getElementById('download-retrieved-certificate');
    var backToLookupBtn = document.getElementById('back-to-lookup');
    var lookupResult = document.getElementById('lookup-result');

    // Helper to refresh count from backend
    async function refreshPledgeCount() {
        if (!pledgeCountElem) return;
        try {
            pledgeCountElem.textContent = '...';
            const count = await getPledgeCount();
            pledgeCountElem.textContent = Number(count).toLocaleString();
        } catch (err) {
            console.warn('Could not load pledge count from Supabase:', err?.message || err);
            // Keep existing text if failed
        }
    }

    // Load initial pledge count from Supabase
    refreshPledgeCount();
    
    // Modal open functionality
    openBtn.onclick = function() { 
        modal.style.display = 'flex'; 
        form.style.display = 'block';
        cert.style.display = 'none';
    };
    
    // Modal close functionality
    closeBtn.onclick = function() { 
        modal.style.display = 'none'; 
    };
    
    // Close modal when clicking outside
    window.onclick = function(event) { 
        if (event.target == modal) { 
            modal.style.display = 'none'; 
        }
        if (event.target == certModal) { 
            certModal.style.display = 'none'; 
        } 
    };
    
    // Certificate modal functionality
    openCertBtn.onclick = function() { 
        certModal.style.display = 'flex'; 
        certLookup.style.display = 'block';
        retrievedCert.style.display = 'none';
        lookupResult.style.display = 'none';
        certLookupForm.reset();
    };
    
    closeCertBtn.onclick = function() { 
        certModal.style.display = 'none'; 
    };
    
    backToLookupBtn.onclick = function() {
        certLookup.style.display = 'block';
        retrievedCert.style.display = 'none';
        lookupResult.style.display = 'none';
    };
    
    // Form submission handler
    form.onsubmit = async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {
            full_name: form.querySelector('#name').value,
            organization: form.querySelector('#org').value,
            date_of_birth: form.querySelector('#dob').value,
            contact_number: form.querySelector('#contact').value,
            place_city: form.querySelector('#city').value,
            pledge_date: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        
        try {
            // Save using API helper
            await savePledge(formData);
            
            // Refresh pledge count from backend
            await refreshPledgeCount();
            
            // Show certificate
            certName.textContent = formData.full_name;
            certDate.textContent = new Date().toLocaleDateString();
            form.style.display = 'none';
            cert.style.display = 'block';
            
        } catch (error) {
            console.error('Error saving pledge:', error);
            alert('There was an error saving your pledge. Please try again.');
        }
    };
    
    // Certificate lookup form submission handler
    certLookupForm.onsubmit = async function(e) {
        e.preventDefault();
        
        const phoneNumber = certLookupForm.querySelector('#lookup-phone').value.trim();
        
        if (!phoneNumber) {
            alert('Please enter a phone number.');
            return;
        }
        
        try {
            // Show loading state
            lookupResult.style.display = 'block';
            lookupResult.innerHTML = '<p>🔍 Searching for your certificate...</p>';
            
            // Search for pledge by phone number
            const pledge = await getPledgeByPhone(phoneNumber);
            
            if (pledge) {
                // Display the certificate
                retrievedCertName.textContent = pledge.full_name;
                retrievedCertDate.textContent = new Date(pledge.pledge_date).toLocaleDateString();
                
                certLookup.style.display = 'none';
                retrievedCert.style.display = 'block';
                lookupResult.style.display = 'none';
            } else {
                // No certificate found
                lookupResult.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; margin-top: 15px;">
                        <h4 style="color: #856404; margin-bottom: 10px;">📋 No Certificate Found</h4>
                        <p style="color: #856404; margin: 0;">No certificate was found for the phone number: <strong>${phoneNumber}</strong></p>
                        <p style="color: #856404; margin: 5px 0 0 0; font-size: 0.9em;">Please check the number and try again, or take a new pledge.</p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error retrieving certificate:', error);
            lookupResult.innerHTML = `
                <div style="text-align: center; padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; margin-top: 15px;">
                    <h4 style="color: #721c24; margin-bottom: 10px;">❌ Error</h4>
                    <p style="color: #721c24; margin: 0;">There was an error retrieving your certificate. Please try again.</p>
                </div>
            `;
        }
    };
    
    // Certificate download functionality
    downloadBtn.onclick = async function() {
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        }
        if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        
        await generateCertificatePDF('certificate-box', 'E-Pledge-Certificate.pdf');
    };
    
    // Retrieved certificate download functionality
    downloadRetrievedBtn.onclick = async function() {
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        }
        if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        
        await generateCertificatePDF('retrieved-certificate-box', 'Retrieved-E-Pledge-Certificate.pdf');
    };
};
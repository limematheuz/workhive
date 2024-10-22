using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.Location
{
    public class LocationCreateDto
    {
        [Required(ErrorMessage = "The address is required")]
        [StringLength(200, ErrorMessage = "The address cannot exceed 200 characters")]
        public string Address { get; set; }

        [Required(ErrorMessage = "The company ID is required")]
        public int CompanyId { get; set; }

        [Required(ErrorMessage = "The company name is required")]
        [StringLength(100, ErrorMessage = "The company name cannot exceed 100 characters")]
        public string CompanyName { get; set; }
    }
}